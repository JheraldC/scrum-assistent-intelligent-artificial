import type { FastifyInstance } from 'fastify';
import { ActivityQuerySchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { requireAuth } from '../auth/index.js';

/** GET /projects/:projectId/activity — historial cronológico de actividades (FR-004). */
export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/projects/:projectId/activity',
    { preHandler: [requireAuth, requireProjectRole()] },
    async (request) => {
      const { projectId } = request.params as { projectId: string };
      const { limit, before } = ActivityQuerySchema.parse(request.query);
      const rows = await app.db.activityLog.findMany({
        where: { projectId, ...(before ? { id: { lt: BigInt(before) } } : {}) },
        orderBy: { id: 'desc' },
        take: limit,
        include: { actor: { select: { pseudonym: true } } },
      });
      return rows.map((row) => ({
        id: Number(row.id),
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorPseudonym: row.actor?.pseudonym ?? null,
        occurredAt: row.occurredAt.toISOString(),
      }));
    },
  );
}
