import { STAGE_TYPES, type GateState, type SprintItemsInput, type SprintUpdate, type StageType } from '@scrum/shared';
import { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { latestRuns } from '../../platform/runs.js';
import { ActivityRecorder } from '../activity/index.js';
import { deriveGateState, type PlanSnapshot } from '../validation/index.js';
import { toSprintDto, type SprintDto } from './dto.js';
import { nextStageStatus, type StageEvent } from './stage-machine.js';

const withStages = { stages: true, items: { select: { backlogItemId: true } } } as const;

/** Compuerta bloqueante de cada etapa (solo planificación y retrospectiva; el resto no bloquea). */
export const STAGE_GATES: Partial<Record<StageType, { gateId: 'GATE-PLAN' | 'GATE-RETRO'; targetType: 'SPRINT' | 'RETROSPECTIVE' }>> = {
  PLANNING: { gateId: 'GATE-PLAN', targetType: 'SPRINT' },
  RETROSPECTIVE: { gateId: 'GATE-RETRO', targetType: 'RETROSPECTIVE' },
};

type SprintWithRelations = Prisma.SprintGetPayload<{ include: typeof withStages }>;

/** Estado derivado de las compuertas de las etapas que la tienen. */
async function stageGateStates(tx: Tx, projectId: string, sprint: SprintWithRelations): Promise<Partial<Record<StageType, GateState>>> {
  const planRun = (await latestRuns(tx, projectId, 'SPRINT', [sprint.id])).get(sprint.id);
  const retroRun = (await latestRuns(tx, projectId, 'RETROSPECTIVE', [sprint.id])).get(sprint.id);
  const reviewRun = (await latestRuns(tx, projectId, 'SPRINT_REVIEW', [sprint.id])).get(sprint.id);
  const review = await tx.sprintReview.findUnique({ where: { sprintId: sprint.id } });
  const retro = await tx.retrospective.findUnique({ where: { sprintId: sprint.id } });
  const latest = (run: typeof planRun) => (run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null);
  return {
    PLANNING: deriveGateState(latest(planRun), sprint.version),
    REVIEW: deriveGateState(latest(reviewRun), review?.version ?? 1),
    RETROSPECTIVE: deriveGateState(latest(retroRun), retro?.version ?? 1),
  };
}

async function toDto(tx: Tx, projectId: string, sprint: SprintWithRelations): Promise<SprintDto> {
  return toSprintDto(sprint, sprint.items.map((i) => i.backlogItemId), await stageGateStates(tx, projectId, sprint));
}

const CLOSED_MESSAGE = 'El Sprint está cerrado: ya no admite cambios.';

/** Crea el Sprint abierto con sus 4 etapas en `PENDING` (FR-005, FR-011). Solo uno abierto por proyecto. */
export async function createSprint(db: Db, clock: Clock, actorId: string, projectId: string): Promise<SprintDto> {
  try {
    return await withTransaction(db, async (tx) => {
      // Serializa la creación de Sprints del mismo proyecto.
      await tx.$queryRaw`SELECT id FROM "project" WHERE id = ${projectId}::uuid FOR UPDATE`;
      const open = await tx.sprint.findFirst({ where: { projectId, status: 'OPEN' } });
      if (open) throw AppError.conflict('Ya hay un Sprint abierto en este proyecto. Ciérrelo antes de crear otro.');

      const last = await tx.sprint.aggregate({ where: { projectId }, _max: { number: true } });
      const now = clock.now();
      const sprint = await tx.sprint.create({
        data: {
          projectId,
          number: (last._max.number ?? 0) + 1,
          createdAt: now,
          updatedAt: now,
          stages: { create: STAGE_TYPES.map((type) => ({ type, createdAt: now, updatedAt: now })) },
        },
        include: withStages,
      });
      await ActivityRecorder.record(tx, {
        projectId,
        actorId,
        action: 'sprint.created',
        entityType: 'sprint',
        entityId: sprint.id,
        payload: { number: sprint.number },
        occurredAt: now,
      });
      return toDto(tx, projectId, sprint);
    });
  } catch (error) {
    // Respaldo del índice único parcial si dos creaciones llegaran a competir.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('Ya hay un Sprint abierto en este proyecto. Ciérrelo antes de crear otro.');
    }
    throw error;
  }
}

export async function listSprints(db: Db, projectId: string) {
  const sprints = await db.sprint.findMany({ where: { projectId }, orderBy: { number: 'desc' } });
  return sprints.map((s) => ({ id: s.id, number: s.number, status: s.status }));
}

async function findSprint(tx: Tx, projectId: string, sprintId: string): Promise<SprintWithRelations> {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId }, include: withStages });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  return sprint;
}

export async function getSprint(db: Db, projectId: string, sprintId: string): Promise<SprintDto> {
  return toDto(db, projectId, await findSprint(db, projectId, sprintId));
}

/** Sprint abierto del proyecto (o `null`); lo usa el detalle del proyecto. */
export async function getOpenSprint(db: Db, projectId: string): Promise<SprintDto | null> {
  const sprint = await db.sprint.findFirst({ where: { projectId, status: 'OPEN' }, include: withStages });
  return sprint ? toDto(db, projectId, sprint) : null;
}

// ---------------------------------------------------------------------------------------------
// Etapas: aplicación de eventos de la máquina de estados
// ---------------------------------------------------------------------------------------------

/**
 * Aplica un evento a una etapa y guarda el resultado (con el reloj del servidor).
 * Devuelve el nuevo estado, o `null` si la transición no estaba permitida (no se modifica nada).
 */
export async function applyStageEvent(tx: Tx, clock: Clock, sprintId: string, stageType: StageType, event: StageEvent) {
  const stage = await tx.sprintStage.findUnique({ where: { sprintId_type: { sprintId, type: stageType } } });
  if (!stage) throw AppError.notFound('No se encontró la etapa.');
  const next = nextStageStatus(stage.status, event);
  if (next === null) return null;
  if (next === stage.status) return stage;
  const now = clock.now();
  return tx.sprintStage.update({
    where: { id: stage.id },
    data: {
      status: next,
      updatedAt: now,
      ...(stage.status === 'PENDING' && next === 'IN_PROGRESS' ? { startedAt: now } : {}),
      ...(next === 'VALIDATED' ? { completedAt: now } : {}),
      ...(stage.status === 'VALIDATED' && next !== 'VALIDATED' ? { completedAt: null } : {}),
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Planificación: Sprint Goal, plan de trabajo y elementos seleccionados (FR-011)
// ---------------------------------------------------------------------------------------------

function versionConflict(current: SprintDto): AppError {
  return new AppError(
    'VERSION_CONFLICT',
    409,
    'Otra persona modificó el Sprint mientras lo editaba. Recargue para ver los cambios.',
    undefined,
    { current },
  );
}

/** Define el Sprint Goal y/o el plan de trabajo con control de versión (FR-036). */
export async function updateSprint(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  input: SprintUpdate,
): Promise<SprintDto> {
  return withTransaction(db, async (tx) => {
    const sprint = await findSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict(CLOSED_MESSAGE);
    const now = clock.now();
    const result = await tx.sprint.updateMany({
      where: { id: sprintId, projectId, version: input.expectedVersion },
      data: {
        ...(input.sprintGoal !== undefined ? { sprintGoal: input.sprintGoal } : {}),
        ...(input.workPlan !== undefined ? { workPlan: input.workPlan } : {}),
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    const fresh = await findSprint(tx, projectId, sprintId);
    if (result.count === 0) throw versionConflict(await toDto(tx, projectId, fresh));
    await applyStageEvent(tx, clock, sprintId, 'PLANNING', 'edit');
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'sprint.updated',
      entityType: 'sprint',
      entityId: sprintId,
      payload: { number: sprint.number },
      occurredAt: now,
    });
    return toDto(tx, projectId, await findSprint(tx, projectId, sprintId));
  });
}

/** Reemplaza los elementos del Product Backlog seleccionados para el Sprint. */
export async function setSprintItems(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  input: SprintItemsInput,
): Promise<SprintDto> {
  const itemIds = [...new Set(input.itemIds)];
  return withTransaction(db, async (tx) => {
    const sprint = await findSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict(CLOSED_MESSAGE);
    const now = clock.now();
    const result = await tx.sprint.updateMany({
      where: { id: sprintId, projectId, version: input.expectedVersion },
      data: { version: { increment: 1 }, updatedAt: now },
    });
    if (result.count === 0) throw versionConflict(await toDto(tx, projectId, await findSprint(tx, projectId, sprintId)));

    const valid = await tx.backlogItem.count({ where: { id: { in: itemIds }, projectId } });
    if (valid !== itemIds.length) {
      // La transacción se revierte: el incremento de versión no queda aplicado.
      throw AppError.validation('Algún elemento seleccionado no pertenece a este proyecto.', [
        { field: 'itemIds', message: 'Todos los elementos deben pertenecer a este proyecto.' },
      ]);
    }
    await tx.sprintItem.deleteMany({ where: { sprintId } });
    if (itemIds.length > 0) {
      await tx.sprintItem.createMany({ data: itemIds.map((backlogItemId) => ({ sprintId, backlogItemId, createdAt: now })) });
    }
    await applyStageEvent(tx, clock, sprintId, 'PLANNING', 'edit');
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'sprint.items_changed',
      entityType: 'sprint',
      entityId: sprintId,
      payload: { count: itemIds.length },
      occurredAt: now,
    });
    return toDto(tx, projectId, await findSprint(tx, projectId, sprintId));
  });
}

/**
 * Instantánea de planificación para el motor de reglas. Bloquea la fila del Sprint (`FOR UPDATE`)
 * y deriva el estado de evaluación de cada historia seleccionada.
 */
export async function getPlanSnapshot(
  tx: Tx,
  projectId: string,
  sprintId: string,
): Promise<{ version: number; snapshot: PlanSnapshot; status: 'OPEN' | 'CLOSED' } | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "sprint" WHERE id = ${sprintId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  const sprint = await tx.sprint.findUniqueOrThrow({ where: { id: sprintId }, include: { items: { include: { backlogItem: true } } } });
  const runs = await latestRuns(tx, projectId, 'BACKLOG_ITEM', sprint.items.map((i) => i.backlogItemId));
  const items = sprint.items
    .map((i) => i.backlogItem)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => {
      const run = runs.get(item.id);
      const latest = run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null;
      return { code: item.code, title: item.title, kind: item.kind, storyState: deriveGateState(latest, item.version) };
    });
  return { version: sprint.version, status: sprint.status, snapshot: { sprintGoal: sprint.sprintGoal, workPlan: sprint.workPlan, items } };
}

// ---------------------------------------------------------------------------------------------
// Evidencia por etapa (FR-006)
// ---------------------------------------------------------------------------------------------

export async function listEvidence(db: Db, projectId: string, sprintId: string, stageType: StageType) {
  const sprint = await findSprint(db, projectId, sprintId);
  const stage = await db.sprintStage.findUnique({ where: { sprintId_type: { sprintId: sprint.id, type: stageType } } });
  if (!stage) throw AppError.notFound('No se encontró la etapa.');
  const rows = await db.evidence.findMany({
    where: { stageId: stage.id },
    orderBy: { createdAt: 'asc' },
    include: { creator: { select: { pseudonym: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    authorPseudonym: r.creator.pseudonym,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** El seguimiento exige la planificación validada (control del prototipo, no regla de Scrum). */
export async function assertTrackingAllowed(tx: Tx, sprintId: string): Promise<void> {
  const planning = await tx.sprintStage.findUnique({ where: { sprintId_type: { sprintId, type: 'PLANNING' } } });
  if (planning?.status !== 'VALIDATED') {
    throw new AppError(
      'STAGE_ORDER',
      409,
      'Antes de trabajar en el seguimiento, la planificación del Sprint debe estar validada.',
    );
  }
}

/** Registra evidencia (FR-006); el primer registro mueve la etapa de PENDING a IN_PROGRESS. */
export async function addEvidence(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  stageType: StageType,
  content: string,
) {
  return withTransaction(db, async (tx) => {
    const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
    if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
    if (sprint.status === 'CLOSED') throw AppError.conflict('El Sprint está cerrado: ya no admite evidencia.');
    const stage = await tx.sprintStage.findUnique({ where: { sprintId_type: { sprintId, type: stageType } } });
    if (!stage) throw AppError.notFound('No se encontró la etapa.');
    if (stageType === 'TRACKING') await assertTrackingAllowed(tx, sprintId);

    const now = clock.now();
    if (stage.status === 'PENDING') await applyStageEvent(tx, clock, sprintId, stageType, 'start');
    const evidence = await tx.evidence.create({
      data: { stageId: stage.id, content, createdBy: actorId, createdAt: now },
      include: { creator: { select: { pseudonym: true } } },
    });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'evidence.added',
      entityType: 'sprint_stage',
      entityId: stage.id,
      payload: { stage: stageType },
      occurredAt: now,
    });
    return {
      id: evidence.id,
      content: evidence.content,
      authorPseudonym: evidence.creator.pseudonym,
      createdAt: evidence.createdAt.toISOString(),
    };
  });
}
