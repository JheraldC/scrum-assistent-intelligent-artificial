import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Role } from '@scrum/shared';
import { AppError } from './errors.js';
import './request-context.js';

const uuid = z.uuid();

/**
 * Autorización por proyecto (FR-003, FR-035). Debe ejecutarse después de `requireAuth`:
 * - sin membresía → 404 (no se revela la existencia del proyecto);
 * - rol insuficiente → 403.
 */
export function requireProjectRole(...roles: Role[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const user = request.user;
    if (!user) throw AppError.unauthenticated();
    const { projectId } = request.params as { projectId?: string };
    if (!projectId || !uuid.safeParse(projectId).success) throw AppError.notFound('No se encontró el proyecto.');

    const membership = await request.server.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!membership) throw AppError.notFound('No se encontró el proyecto.');
    if (roles.length > 0 && !roles.includes(membership.role)) throw AppError.forbidden();
    request.membership = { projectId, role: membership.role };
  };
}
