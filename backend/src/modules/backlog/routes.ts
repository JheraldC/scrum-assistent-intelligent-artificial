import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BacklogItemInputSchema, BacklogItemUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { createItem, getItem, listItems, updateItem } from './service.js';

const ItemParams = z.object({ projectId: z.uuid(), itemId: z.uuid() });

export async function backlogRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];

  app.get('/projects/:projectId/backlog', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return listItems(app.db, projectId);
  });

  app.post('/projects/:projectId/backlog', { preHandler: anyMember }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = BacklogItemInputSchema.parse(request.body);
    return reply.status(201).send(await createItem(app.db, app.clock, request.user!.id, projectId, input));
  });

  app.get('/projects/:projectId/backlog/:itemId', { preHandler: anyMember }, async (request) => {
    const parsed = ItemParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
    return getItem(app.db, parsed.data.projectId, parsed.data.itemId);
  });

  app.patch('/projects/:projectId/backlog/:itemId', { preHandler: anyMember }, async (request) => {
    const parsed = ItemParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
    const input = BacklogItemUpdateSchema.parse(request.body);
    return updateItem(app.db, app.clock, request.user!.id, parsed.data.projectId, parsed.data.itemId, input);
  });
}
