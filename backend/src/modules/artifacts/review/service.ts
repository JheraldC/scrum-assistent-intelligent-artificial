import type { GateState, SprintReviewUpdate } from '@scrum/shared';
import { AppError } from '../../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../../platform/db.js';
import type { Clock } from '../../../platform/clock.js';
import { latestRuns } from '../../../platform/runs.js';
import { ActivityRecorder } from '../../activity/index.js';
import { deriveGateState, type ReviewSnapshot } from '../../validation/index.js';
import { touchStage } from '../stage-reopen.js';

const CLOSED_MESSAGE = 'El Sprint está cerrado: ya no admite cambios en su Review.';

async function requireSprint(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  return sprint;
}

/** Garantiza que el Sprint tenga su Review (se crea al primer acceso). */
async function ensureReview(tx: Tx, sprintId: string) {
  await tx.sprintReview.upsert({ where: { sprintId }, create: { sprintId }, update: {} });
}

async function buildDto(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await requireSprint(tx, projectId, sprintId);
  await ensureReview(tx, sprintId);
  const review = await tx.sprintReview.findUniqueOrThrow({ where: { sprintId } });
  const run = (await latestRuns(tx, projectId, 'SPRINT_REVIEW', [sprintId])).get(sprintId);
  const gateState: GateState = deriveGateState(
    run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null,
    review.version,
  );
  return {
    results: review.results,
    increment: review.increment,
    feedback: review.feedback,
    goalAssessment: review.goalAssessment,
    goalAssessmentNote: review.goalAssessmentNote,
    version: review.version,
    gateState,
    sprintStatus: sprint.status,
    // La Review se compara con el objetivo del Sprint, que se muestra junto al formulario.
    sprintGoal: sprint.sprintGoal,
  };
}

export async function getReview(db: Db, projectId: string, sprintId: string) {
  return withTransaction(db, (tx) => buildDto(tx, projectId, sprintId));
}

/** Guarda la Review con control de versión (FR-036, FR-039). */
export async function updateReview(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, input: SprintReviewUpdate) {
  return withTransaction(db, async (tx) => {
    const sprint = await requireSprint(tx, projectId, sprintId);
    if (sprint.status === 'CLOSED') throw AppError.conflict(CLOSED_MESSAGE);
    await ensureReview(tx, sprintId);
    const now = clock.now();
    const result = await tx.sprintReview.updateMany({
      where: { sprintId, version: input.expectedVersion },
      data: {
        results: input.results,
        increment: input.increment,
        feedback: input.feedback,
        goalAssessment: input.goalAssessment,
        goalAssessmentNote: input.goalAssessmentNote,
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    if (result.count === 0) {
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'Otra persona modificó la Review mientras la editaba. Recargue para ver los cambios.',
        undefined,
        { current: await buildDto(tx, projectId, sprintId) },
      );
    }
    await touchStage(tx, clock, sprintId, 'REVIEW');
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'review.updated', entityType: 'sprint_review', entityId: sprintId, occurredAt: now });
    return buildDto(tx, projectId, sprintId);
  });
}

/** Instantánea para el motor de reglas (GATE-REVIEW); bloquea la fila de la Review. */
export async function getReviewSnapshot(
  tx: Tx,
  projectId: string,
  sprintId: string,
): Promise<{ version: number; snapshot: ReviewSnapshot; closed: boolean } | null> {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) return null;
  await ensureReview(tx, sprintId);
  await tx.$queryRaw`SELECT sprint_id FROM "sprint_review" WHERE sprint_id = ${sprintId}::uuid FOR UPDATE`;
  const review = await tx.sprintReview.findUniqueOrThrow({ where: { sprintId } });
  return {
    version: review.version,
    closed: sprint.status === 'CLOSED',
    snapshot: {
      results: review.results,
      increment: review.increment,
      feedback: review.feedback,
      goalAssessment: review.goalAssessment,
      goalAssessmentNote: review.goalAssessmentNote,
    },
  };
}
