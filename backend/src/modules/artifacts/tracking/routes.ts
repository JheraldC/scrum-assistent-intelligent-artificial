import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TrackingEntryInputSchema } from '@scrum/shared';
import { requireProjectRole } from '../../../platform/access.js';
import { AppError } from '../../../platform/errors.js';
import { requireAuth } from '../../auth/index.js';
import { addTracking, listTracking, resolveImpediment } from './service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });
const EntryParams = SprintParams.extend({ entryId: z.uuid() });

function parse<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el recurso solicitado.');
  return parsed.data;
}

/** Seguimiento del Sprint: avances, impedimentos, observaciones y notas de la reunión diaria (FR-038). */
export async function trackingRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const base = '/projects/:projectId/sprints/:sprintId/tracking';

  app.get(base, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    return listTracking(app.db, projectId, sprintId);
  });

  app.post(base, { preHandler: anyMember }, async (request, reply) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    const input = TrackingEntryInputSchema.parse(request.body);
    return reply.status(201).send(await addTracking(app.db, app.clock, request.user!.id, projectId, sprintId, input));
  });

  app.post(`${base}/:entryId/resolve`, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId, entryId } = parse(EntryParams, request.params);
    return resolveImpediment(app.db, app.clock, request.user!.id, projectId, sprintId, entryId);
  });
}
