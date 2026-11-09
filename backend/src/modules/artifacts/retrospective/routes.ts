import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RetroActionInputSchema, RetroActionUpdateSchema, RetrospectiveUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../../platform/access.js';
import { AppError } from '../../../platform/errors.js';
import { requireAuth } from '../../auth/index.js';
import { createAction, getRetrospective, updateAction, updateRetrospective } from './service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });
const ActionParams = SprintParams.extend({ actionId: z.uuid() });

function parse<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el recurso solicitado.');
  return parsed.data;
}

/** Retrospectiva del Sprint y sus acciones de mejora (FR-018, FR-019). */
export async function retrospectiveRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const base = '/projects/:projectId/sprints/:sprintId/retrospective';

  app.get(base, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    return getRetrospective(app.db, projectId, sprintId);
  });

  app.put(base, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    const input = RetrospectiveUpdateSchema.parse(request.body);
    return updateRetrospective(app.db, app.clock, request.user!.id, projectId, sprintId, input);
  });

  app.post(`${base}/actions`, { preHandler: anyMember }, async (request, reply) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    const input = RetroActionInputSchema.parse(request.body);
    return reply.status(201).send(await createAction(app.db, app.clock, request.user!.id, projectId, sprintId, input));
  });

  app.patch(`${base}/actions/:actionId`, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId, actionId } = parse(ActionParams, request.params);
    const input = RetroActionUpdateSchema.parse(request.body);
    return updateAction(app.db, app.clock, request.user!.id, projectId, sprintId, actionId, input);
  });
}
