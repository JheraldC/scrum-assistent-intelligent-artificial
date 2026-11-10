import type { GateState, RetroActionInput, RetroActionUpdate, RetrospectiveUpdate } from '@scrum/shared';
import { AppError } from '../../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../../platform/db.js';
import type { Clock } from '../../../platform/clock.js';
import { latestRuns } from '../../../platform/runs.js';
import { ActivityRecorder } from '../../activity/index.js';
import { applyStageEvent } from '../../sprints/index.js';
import { deriveGateState, type RetroSnapshot } from '../../validation/index.js';

const CLOSED_MESSAGE = 'El Sprint está cerrado: ya no admite cambios en su retrospectiva.';

interface ActionRow {
  id: string;
  sprintId: string;
  description: string;
  ownerId: string | null;
  owner?: { pseudonym: string } | null;
  forNextSprint: boolean;
  status: 'OPEN' | 'DONE' | 'DISCARDED';
  followUpNote: string;
  followUpUpdatedAt: Date | null;
  version: number;
}

export function toActionDto(a: ActionRow) {
  return {
    id: a.id,
    description: a.description,
    ownerId: a.ownerId,
    ownerPseudonym: a.owner?.pseudonym ?? null,
    forNextSprint: a.forNextSprint,
    status: a.status,
    followUpNote: a.followUpNote,
    followUpUpdatedAt: a.followUpUpdatedAt?.toISOString() ?? null,
    version: a.version,
  };
}

const withActions = { actions: { include: { owner: { select: { pseudonym: true } } }, orderBy: { createdAt: 'asc' as const } } };

/** Garantiza que el Sprint tenga su retrospectiva (se crea al primer acceso). */
async function ensureRetro(tx: Tx, sprintId: string) {
  // `ON CONFLICT DO NOTHING`: dos solicitudes simultáneas sobre una retrospectiva aún no creada no deben
  // chocar con la clave primaria (el `upsert` de Prisma no es atómico y producía un 500).
  await tx.$executeRaw`INSERT INTO "retrospective" (sprint_id) VALUES (${sprintId}::uuid) ON CONFLICT (sprint_id) DO NOTHING`;
}

async function requireSprint(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  return sprint;
}

/** Acciones del Sprint anterior (el de número inmediatamente menor), con su seguimiento. */
async function previousSprintActions(tx: Tx, projectId: string, sprintNumber: number) {
  const previous = await tx.sprint.findFirst({ where: { projectId, number: { lt: sprintNumber } }, orderBy: { number: 'desc' } });
  if (!previous) return { previous: null, actions: [] as ActionRow[] };
  const actions = await tx.retroAction.findMany({
    where: { sprintId: previous.id },
    orderBy: { createdAt: 'asc' },
    include: { owner: { select: { pseudonym: true } } },
  });
  return { previous, actions };
}

async function buildDto(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await requireSprint(tx, projectId, sprintId);
  await ensureRetro(tx, sprintId);
  const retro = await tx.retrospective.findUniqueOrThrow({ where: { sprintId }, include: withActions });
  const run = (await latestRuns(tx, projectId, 'RETROSPECTIVE', [sprintId])).get(sprintId);
  const gateState: GateState = deriveGateState(
    run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null,
    retro.version,
  );
  const { previous, actions: previousActions } = await previousSprintActions(tx, projectId, sprint.number);
  return {
    positives: retro.positives,
    problems: retro.problems,
    improvements: retro.improvements,
    version: retro.version,
    gateState,
    sprintStatus: sprint.status,
    actions: retro.actions.map(toActionDto),
    // Acciones del Sprint anterior: se les actualiza el seguimiento en esta retrospectiva (FR-019).
    previousSprint: previous ? { id: previous.id, number: previous.number } : null,
    previousActions: previousActions.map(toActionDto),
  };
}

export async function getRetrospective(db: Db, projectId: string, sprintId: string) {
  return withTransaction(db, (tx) => buildDto(tx, projectId, sprintId));
}

const clean = (list: string[]) => list.map((t) => t.trim()).filter((t) => t !== '');

function conflictOf<T>(message: string, current: T): AppError {
  return new AppError('VERSION_CONFLICT', 409, message, undefined, { current });
}

/** Guarda positivos, problemas y mejoras con control de versión (FR-036). */
export async function updateRetrospective(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  input: RetrospectiveUpdate,
) {
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict(CLOSED_MESSAGE);
    await ensureRetro(tx, sprintId);
    const now = clock.now();
    const result = await tx.retrospective.updateMany({
      where: { sprintId, version: input.expectedVersion },
      data: {
        positives: clean(input.positives),
        problems: clean(input.problems),
        improvements: clean(input.improvements),
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    if (result.count === 0) {
      throw conflictOf('Otra persona modificó la retrospectiva mientras la editaba. Recargue para ver los cambios.', await buildDto(tx, projectId, sprintId));
    }
    await applyStageEvent(tx, clock, sprintId, 'RETROSPECTIVE', 'edit');
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'retrospective.updated', entityType: 'retrospective', entityId: sprintId, occurredAt: now });
    return buildDto(tx, projectId, sprintId);
  });
}

async function assertOwnerIsMember(tx: Tx, projectId: string, ownerId: string | null | undefined): Promise<void> {
  if (!ownerId) return;
  const member = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: ownerId } } });
  if (!member) {
    throw AppError.validation('El responsable debe ser miembro del proyecto.', [{ field: 'ownerId', message: 'El responsable debe ser miembro del proyecto.' }]);
  }
}

/** Una acción nueva o editada cambia el contenido de la retrospectiva: sube su versión y reabre la evaluación. */
async function touchRetro(tx: Tx, clock: Clock, sprintId: string): Promise<void> {
  await tx.retrospective.update({ where: { sprintId }, data: { version: { increment: 1 }, updatedAt: clock.now() } });
  await applyStageEvent(tx, clock, sprintId, 'RETROSPECTIVE', 'edit');
}

export async function createAction(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, input: RetroActionInput) {
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict(CLOSED_MESSAGE);
    await ensureRetro(tx, sprintId);
    await assertOwnerIsMember(tx, projectId, input.ownerId);
    const now = clock.now();
    const action = await tx.retroAction.create({
      data: {
        sprintId,
        description: input.description,
        ownerId: input.ownerId ?? null,
        forNextSprint: input.forNextSprint ?? false,
        status: input.status ?? 'OPEN',
        followUpNote: input.followUpNote ?? '',
        createdAt: now,
      },
      include: { owner: { select: { pseudonym: true } } },
    });
    await touchRetro(tx, clock, sprintId);
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'retro_action.created', entityType: 'retro_action', entityId: action.id, occurredAt: now });
    return toActionDto(action);
  });
}

/**
 * Edita una acción con control de versión. En un Sprint cerrado solo se admite actualizar su
 * seguimiento (estado y nota): así el equipo revisa las acciones del Sprint anterior (RETRO-05).
 */
export async function updateAction(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  actionId: string,
  input: RetroActionUpdate,
) {
  const { expectedVersion, ...fields } = input;
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    const existing = await tx.retroAction.findFirst({ where: { id: actionId, sprintId }, include: { owner: { select: { pseudonym: true } } } });
    if (!existing) throw AppError.notFound('No se encontró la acción.');
    const closed = sprint.status === 'CLOSED';
    if (closed && (fields.description !== undefined || fields.ownerId !== undefined || fields.forNextSprint !== undefined)) {
      throw AppError.conflict('El Sprint está cerrado: solo se puede actualizar el seguimiento (estado y nota) de sus acciones.');
    }
    await assertOwnerIsMember(tx, projectId, fields.ownerId);

    const now = clock.now();
    const followUpChanged =
      (fields.status !== undefined && fields.status !== existing.status) ||
      (fields.followUpNote !== undefined && fields.followUpNote !== existing.followUpNote);
    const result = await tx.retroAction.updateMany({
      where: { id: actionId, sprintId, version: expectedVersion },
      data: {
        ...(fields.description !== undefined ? { description: fields.description } : {}),
        ...(fields.ownerId !== undefined ? { ownerId: fields.ownerId } : {}),
        ...(fields.forNextSprint !== undefined ? { forNextSprint: fields.forNextSprint } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.followUpNote !== undefined ? { followUpNote: fields.followUpNote } : {}),
        ...(followUpChanged ? { followUpUpdatedAt: now } : {}),
        version: { increment: 1 },
      },
    });
    const current = await tx.retroAction.findUniqueOrThrow({ where: { id: actionId }, include: { owner: { select: { pseudonym: true } } } });
    if (result.count === 0) {
      throw conflictOf('Otra persona modificó esta acción mientras la editaba. Recargue para ver los cambios.', toActionDto(current));
    }
    if (!closed) await touchRetro(tx, clock, sprintId);
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'retro_action.updated', entityType: 'retro_action', entityId: actionId, occurredAt: now });
    return toActionDto(current);
  });
}

/**
 * Instantánea para el motor de reglas (GATE-RETRO). Bloquea la fila de la retrospectiva
 * (`FOR UPDATE`) y reúne las acciones del Sprint anterior para RETRO-05.
 */
export async function getRetroSnapshot(
  tx: Tx,
  projectId: string,
  sprintId: string,
): Promise<{ version: number; snapshot: RetroSnapshot; closed: boolean } | null> {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) return null;
  await ensureRetro(tx, sprintId);
  await tx.$queryRaw`SELECT sprint_id FROM "retrospective" WHERE sprint_id = ${sprintId}::uuid FOR UPDATE`;
  const retro = await tx.retrospective.findUniqueOrThrow({ where: { sprintId }, include: { actions: { orderBy: { createdAt: 'asc' } } } });
  const { actions: previous } = await previousSprintActions(tx, projectId, sprint.number);
  return {
    version: retro.version,
    closed: sprint.status === 'CLOSED',
    snapshot: {
      positives: retro.positives,
      problems: retro.problems,
      improvements: retro.improvements,
      actions: retro.actions.map((a) => ({ description: a.description, ownerId: a.ownerId, forNextSprint: a.forNextSprint })),
      previousActions: previous.map((a) => ({ followUpUpdatedAt: a.followUpUpdatedAt?.toISOString() ?? null })),
      sprintStartedAt: sprint.createdAt.toISOString(),
    },
  };
}
