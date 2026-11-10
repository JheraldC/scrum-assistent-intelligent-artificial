import type { Role, ScrumResponsibility } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';

const LAST_FACILITATOR_MESSAGE = 'El proyecto debe conservar al menos un Facilitador.';

/**
 * Bloquea las filas de miembros del proyecto (FOR UPDATE): los cambios simultáneos de rol se
 * serializan y la regla "al menos un Facilitador" se comprueba sobre datos estables.
 */
async function lockMembers(tx: Tx, projectId: string): Promise<void> {
  await tx.$queryRaw`SELECT user_id FROM "project_member" WHERE project_id = ${projectId}::uuid FOR UPDATE`;
}

async function facilitatorCount(tx: Tx, projectId: string): Promise<number> {
  return tx.projectMember.count({ where: { projectId, role: 'FACILITATOR' } });
}

export async function listMembers(db: Db, projectId: string, viewerRole: Role) {
  const rows = await db.projectMember.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((m) => ({
    userId: m.userId,
    pseudonym: m.user.pseudonym,
    role: m.role as Role,
    responsibilities: m.responsibilities,
    // El correo solo lo ve el Facilitador (plan.md, matriz de permisos).
    ...(viewerRole === 'FACILITATOR' ? { email: m.user.email } : {}),
  }));
}

export async function addMember(db: Db, clock: Clock, actorId: string, projectId: string, email: string, role: Role) {
  return withTransaction(db, async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    // Decisión de la spec (A2): sin invitaciones; la persona debe registrarse primero.
    if (!user) throw AppError.notFound('La persona debe registrarse primero.');
    const existing = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) throw AppError.conflict('Esa persona ya participa en el proyecto.');
    const now = clock.now();
    await tx.projectMember.create({ data: { projectId, userId: user.id, role, createdAt: now } });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'member.added',
      entityType: 'project_member',
      entityId: user.id,
      payload: { role },
      occurredAt: now,
    });
    return { userId: user.id, pseudonym: user.pseudonym, role, responsibilities: [] as string[], email: user.email };
  });
}

export async function changeRole(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  userId: string,
  role: Role,
) {
  return withTransaction(db, async (tx) => {
    await lockMembers(tx, projectId);
    const member = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { user: true },
    });
    if (!member) throw AppError.notFound('No se encontró a esa persona en el proyecto.');
    if (member.role === 'FACILITATOR' && role !== 'FACILITATOR' && (await facilitatorCount(tx, projectId)) <= 1) {
      throw new AppError('LAST_FACILITATOR', 409, LAST_FACILITATOR_MESSAGE);
    }
    const now = clock.now();
    await tx.projectMember.update({ where: { projectId_userId: { projectId, userId } }, data: { role } });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'member.role_changed',
      entityType: 'project_member',
      entityId: userId,
      payload: { role },
      occurredAt: now,
    });
    return { userId, pseudonym: member.user.pseudonym, role, responsibilities: member.responsibilities, email: member.user.email };
  });
}

/**
 * Responsabilidades Scrum de una persona en este proyecto (configurables por el Facilitador).
 * No cambian ningún permiso técnico: son una etiqueta de trabajo que orienta las vistas.
 */
export async function setResponsibilities(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  userId: string,
  responsibilities: ScrumResponsibility[],
) {
  return withTransaction(db, async (tx) => {
    const member = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { user: true },
    });
    if (!member) throw AppError.notFound('No se encontró a esa persona en el proyecto.');
    await tx.projectMember.update({ where: { projectId_userId: { projectId, userId } }, data: { responsibilities } });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'member.responsibilities_changed',
      entityType: 'project_member',
      entityId: userId,
      payload: { responsibilities: responsibilities.join(",") },
      occurredAt: clock.now(),
    });
    return { userId, pseudonym: member.user.pseudonym, role: member.role as Role, responsibilities, email: member.user.email };
  });
}

export async function removeMember(db: Db, clock: Clock, actorId: string, projectId: string, userId: string) {
  await withTransaction(db, async (tx) => {
    await lockMembers(tx, projectId);
    const member = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!member) throw AppError.notFound('No se encontró a esa persona en el proyecto.');
    if (member.role === 'FACILITATOR' && (await facilitatorCount(tx, projectId)) <= 1) {
      throw new AppError('LAST_FACILITATOR', 409, LAST_FACILITATOR_MESSAGE);
    }
    // Pierde el acceso; sus contribuciones se conservan (FK sin cascada).
    await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'member.removed',
      entityType: 'project_member',
      entityId: userId,
      occurredAt: clock.now(),
    });
  });
}
