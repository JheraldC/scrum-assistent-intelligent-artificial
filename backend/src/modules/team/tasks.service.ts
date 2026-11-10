import type { SprintTaskInput, SprintTaskUpdate } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';

interface TaskRow {
  id: string;
  sprintId: string;
  backlogItemId: string | null;
  title: string;
  status: 'TODO' | 'DOING' | 'DONE';
  assigneeId: string | null;
  fromAi: boolean;
  version: number;
  updatedAt: Date;
  backlogItem?: { code: string; title: string } | null;
  assignee?: { pseudonym: string } | null;
}

const include = { backlogItem: { select: { code: true, title: true } }, assignee: { select: { pseudonym: true } } } as const;

export function toTaskDto(t: TaskRow) {
  return {
    id: t.id,
    sprintId: t.sprintId,
    backlogItemId: t.backlogItemId,
    itemCode: t.backlogItem?.code ?? null,
    itemTitle: t.backlogItem?.title ?? null,
    title: t.title,
    status: t.status,
    assigneeId: t.assigneeId,
    assigneePseudonym: t.assignee?.pseudonym ?? null,
    fromAi: t.fromAi,
    version: t.version,
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function requireOpenSprint(tx: Tx, projectId: string, sprintId: string) {
  const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  if (sprint.status === 'CLOSED') throw AppError.conflict('El Sprint está cerrado: ya no admite cambios en sus tareas.');
  return sprint;
}

/** La tarea solo puede colgar de un elemento seleccionado para este Sprint, y el responsable debe ser miembro. */
async function checkLinks(tx: Tx, projectId: string, sprintId: string, input: { backlogItemId?: string | null; assigneeId?: string | null }) {
  if (input.backlogItemId) {
    const selected = await tx.sprintItem.findUnique({ where: { sprintId_backlogItemId: { sprintId, backlogItemId: input.backlogItemId } } });
    if (!selected) {
      throw AppError.validation('La tarea solo puede asociarse a un elemento seleccionado para este Sprint.', [
        { field: 'backlogItemId', message: 'El elemento no está seleccionado para este Sprint.' },
      ]);
    }
  }
  if (input.assigneeId) {
    const member = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: input.assigneeId } } });
    if (!member) {
      throw AppError.validation('El responsable debe ser miembro del proyecto.', [{ field: 'assigneeId', message: 'El responsable debe ser miembro del proyecto.' }]);
    }
  }
}

export async function listTasks(db: Db, projectId: string, sprintId: string) {
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
  const rows = await db.sprintTask.findMany({ where: { sprintId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include });
  return rows.map(toTaskDto);
}

/** Crea una tarea dentro de una transacción ya abierta (la usan el endpoint y la aceptación de sugerencias). */
export async function createTaskInTx(
  tx: Tx,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  input: SprintTaskInput,
  options: { fromAi?: boolean } = {},
) {
  await requireOpenSprint(tx, projectId, sprintId);
  await checkLinks(tx, projectId, sprintId, input);
  const now = clock.now();
  const task = await tx.sprintTask.create({
    data: {
      sprintId,
      backlogItemId: input.backlogItemId ?? null,
      title: input.title,
      status: input.status ?? 'TODO',
      assigneeId: input.assigneeId ?? null,
      fromAi: options.fromAi ?? false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    },
    include,
  });
  await ActivityRecorder.record(tx, {
    projectId,
    actorId,
    action: 'task.created',
    entityType: 'sprint_task',
    entityId: task.id,
    payload: { origin: options.fromAi ? 'AI_SUGGESTION' : 'MANUAL' },
    occurredAt: now,
  });
  return toTaskDto(task);
}

export async function createTask(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, input: SprintTaskInput) {
  return withTransaction(db, (tx) => createTaskInTx(tx, clock, actorId, projectId, sprintId, input));
}

export async function updateTask(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  taskId: string,
  input: SprintTaskUpdate,
) {
  const { expectedVersion, ...fields } = input;
  return withTransaction(db, async (tx) => {
    await requireOpenSprint(tx, projectId, sprintId);
    const existing = await tx.sprintTask.findFirst({ where: { id: taskId, sprintId }, include });
    if (!existing) throw AppError.notFound('No se encontró la tarea.');
    await checkLinks(tx, projectId, sprintId, fields);
    const now = clock.now();
    const result = await tx.sprintTask.updateMany({
      where: { id: taskId, sprintId, version: expectedVersion },
      data: {
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.backlogItemId !== undefined ? { backlogItemId: fields.backlogItemId } : {}),
        ...(fields.assigneeId !== undefined ? { assigneeId: fields.assigneeId } : {}),
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    const current = await tx.sprintTask.findUniqueOrThrow({ where: { id: taskId }, include });
    if (result.count === 0) {
      throw new AppError('VERSION_CONFLICT', 409, 'Otra persona modificó esta tarea mientras la editaba. Recargue para ver los cambios.', undefined, {
        current: toTaskDto(current),
      });
    }
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'task.updated', entityType: 'sprint_task', entityId: taskId, occurredAt: now });
    return toTaskDto(current);
  });
}

export async function deleteTask(db: Db, clock: Clock, actorId: string, projectId: string, sprintId: string, taskId: string) {
  await withTransaction(db, async (tx) => {
    await requireOpenSprint(tx, projectId, sprintId);
    const result = await tx.sprintTask.deleteMany({ where: { id: taskId, sprintId } });
    if (result.count === 0) throw AppError.notFound('No se encontró la tarea.');
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'task.deleted', entityType: 'sprint_task', entityId: taskId, occurredAt: clock.now() });
  });
}
