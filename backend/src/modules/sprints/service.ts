import { STAGE_TYPES, type StageType } from '@scrum/shared';
import { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';
import { toSprintDto, type SprintDto } from './dto.js';

const withStages = { stages: true } as const;

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
      return toSprintDto(sprint);
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

async function findSprint(db: Db, projectId: string, sprintId: string) {
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, projectId }, include: withStages });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  return sprint;
}

export async function getSprint(db: Db, projectId: string, sprintId: string): Promise<SprintDto> {
  return toSprintDto(await findSprint(db, projectId, sprintId));
}

/** Sprint abierto del proyecto (o `null`); lo usa el detalle del proyecto. */
export async function getOpenSprint(db: Db, projectId: string): Promise<SprintDto | null> {
  const sprint = await db.sprint.findFirst({ where: { projectId, status: 'OPEN' }, include: withStages });
  return sprint ? toSprintDto(sprint) : null;
}

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

    const now = clock.now();
    if (stage.status === 'PENDING') {
      await tx.sprintStage.update({
        where: { id: stage.id },
        data: { status: 'IN_PROGRESS', startedAt: now, updatedAt: now },
      });
    }
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
