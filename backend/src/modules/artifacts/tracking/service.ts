import type { TrackingEntryInput } from '@scrum/shared';
import { AppError } from '../../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../../platform/db.js';
import type { Clock } from '../../../platform/clock.js';
import { ActivityRecorder } from '../../activity/index.js';
import { assertTrackingAllowed } from '../../sprints/index.js';
import { touchStage } from '../stage-reopen.js';

interface EntryRow {
  id: string;
  kind: 'PROGRESS' | 'IMPEDIMENT' | 'OBSERVATION' | 'DAILY_NOTE';
  content: string;
  resolvedAt: Date | null;
  createdAt: Date;
  creator: { pseudonym: string };
}

const include = { creator: { select: { pseudonym: true } } } as const;

export function toEntryDto(e: EntryRow) {
  return {
    id: e.id,
    kind: e.kind,
    content: e.content,
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
    authorPseudonym: e.creator.pseudonym,
    createdAt: e.createdAt.toISOString(),
  };
}

async function requireSprint(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  return sprint;
}

/** Entradas de seguimiento, de la más reciente a la más antigua. */
export async function listTracking(db: Db, projectId: string, sprintId: string) {
  await requireSprint(db, projectId, sprintId);
  const rows = await db.trackingEntry.findMany({ where: { sprintId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include });
  return rows.map(toEntryDto);
}

/** Registra un avance, impedimento, observación o nota de la reunión diaria (FR-038). */
export async function addTracking(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, input: TrackingEntryInput) {
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict('El Sprint está cerrado: ya no admite registros de seguimiento.');
    await assertTrackingAllowed(tx, sprintId);
    const now = clock.now();
    const entry = await tx.trackingEntry.create({
      data: { sprintId, kind: input.kind, content: input.content, createdBy: actorId, createdAt: now },
      include,
    });
    await touchStage(tx, clock, sprintId, 'TRACKING');
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'tracking.added',
      entityType: 'tracking_entry',
      entityId: entry.id,
      payload: { kind: input.kind },
      occurredAt: now,
    });
    return toEntryDto(entry);
  });
}

/** Marca un impedimento como resuelto con la fecha del servidor. */
export async function resolveImpediment(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, entryId: string) {
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict('El Sprint está cerrado: ya no admite cambios de seguimiento.');
    const entry = await tx.trackingEntry.findFirst({ where: { id: entryId, sprintId }, include });
    if (!entry) throw AppError.notFound('No se encontró el registro de seguimiento.');
    if (entry.kind !== 'IMPEDIMENT') throw AppError.conflict('Solo los impedimentos se pueden marcar como resueltos.');
    const now = clock.now();
    // El filtro por `resolvedAt: null` evita que dos resoluciones simultáneas pasen las dos.
    const result = await tx.trackingEntry.updateMany({ where: { id: entryId, resolvedAt: null }, data: { resolvedAt: now } });
    if (result.count === 0) throw AppError.conflict('Este impedimento ya está resuelto.');
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'tracking.impediment_resolved',
      entityType: 'tracking_entry',
      entityId: entryId,
      occurredAt: now,
    });
    return toEntryDto({ ...entry, resolvedAt: now });
  });
}
