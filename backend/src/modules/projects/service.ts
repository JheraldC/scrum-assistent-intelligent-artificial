import type { ProjectInput, ProjectStatus, ProjectUpdate, Role } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';
import { getOpenSprint } from '../sprints/index.js';

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  productGoal: string;
  definitionOfDone: string;
  isSample: boolean;
  version: number;
  createdAt: Date;
}

export function toProjectDto(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    productGoal: p.productGoal,
    definitionOfDone: p.definitionOfDone,
    isSample: p.isSample,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
  };
}

interface SprintForStatus {
  status: 'OPEN' | 'CLOSED';
  stages: { status: string }[];
}

/** Estado derivado del proyecto (FR-004); no se almacena (data-model.md). */
export function deriveProjectStatus(sprints: SprintForStatus[]): ProjectStatus {
  if (sprints.length === 0) return 'SIN_SPRINT';
  const open = sprints.find((s) => s.status === 'OPEN');
  if (!open) return 'CERRADO';
  return open.stages.some((s) => s.status === 'NEEDS_CORRECTION') ? 'REQUIERE_CORRECCION' : 'EN_CURSO';
}

/** Crea el proyecto; quien lo crea queda como Facilitador de ese proyecto (FR-002). */
export async function createProject(db: Db, clock: Clock, actorId: string, input: ProjectInput) {
  return withTransaction(db, async (tx) => {
    const now = clock.now();
    const project = await tx.project.create({
      data: { ...input, createdBy: actorId, createdAt: now, updatedAt: now },
    });
    await tx.projectMember.create({
      data: { projectId: project.id, userId: actorId, role: 'FACILITATOR', createdAt: now },
    });
    await ActivityRecorder.record(tx, {
      projectId: project.id,
      actorId,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      occurredAt: now,
    });
    return toProjectDto(project);
  });
}

export async function listProjects(db: Db, userId: string) {
  const memberships = await db.projectMember.findMany({
    where: { userId },
    include: { project: { include: { sprints: { include: { stages: true } } } } },
    orderBy: { project: { createdAt: 'desc' } },
  });
  return memberships.map((m) => ({
    ...toProjectDto(m.project),
    myRole: m.role as Role,
    status: deriveProjectStatus(m.project.sprints),
  }));
}

export async function getProjectDetail(db: Db, projectId: string, role: Role) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { sprints: { include: { stages: true } } },
  });
  if (!project) throw AppError.notFound('No se encontró el proyecto.');
  return {
    ...toProjectDto(project),
    myRole: role,
    status: deriveProjectStatus(project.sprints),
    openSprint: await getOpenSprint(db, projectId),
  };
}

/** Edición con control de versión (FR-036): 409 con el estado actual si la versión no coincide. */
export async function updateProject(db: Db, clock: Clock, actorId: string, projectId: string, input: ProjectUpdate) {
  const { expectedVersion, ...fields } = input;
  return withTransaction(db, async (tx) => {
    const now = clock.now();
    const result = await tx.project.updateMany({
      where: { id: projectId, version: expectedVersion },
      data: { ...fields, version: { increment: 1 }, updatedAt: now },
    });
    const current = await tx.project.findUnique({ where: { id: projectId } });
    if (!current) throw AppError.notFound('No se encontró el proyecto.');
    if (result.count === 0) {
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'Otra persona modificó el proyecto mientras lo editaba. Recargue para ver los cambios.',
        undefined,
        { current: toProjectDto(current) },
      );
    }
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'project.updated',
      entityType: 'project',
      entityId: projectId,
      occurredAt: now,
    });
    return toProjectDto(current);
  });
}
