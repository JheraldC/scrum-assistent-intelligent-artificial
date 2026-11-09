import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvaluateRequestSchema, ValidationQuerySchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { criteriaCatalog, evaluateGate, getRun, listRuns } from './service.js';

const RunParams = z.object({ projectId: z.uuid(), validationId: z.uuid() });

export async function flowRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];

  // Catálogo de compuertas y criterios con su origen oficial/adicional (FR-017).
  app.get('/criteria-catalog', { preHandler: requireAuth }, async () => criteriaCatalog());

  app.post('/projects/:projectId/validations', { preHandler: anyMember }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = EvaluateRequestSchema.parse(request.body);
    return reply.status(201).send(await evaluateGate(app.db, app.clock, request.user!.id, projectId, input));
  });

  app.get('/projects/:projectId/validations', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const filter = ValidationQuerySchema.parse(request.query);
    return listRuns(app.db, projectId, filter);
  });

  app.get('/projects/:projectId/validations/:validationId', { preHandler: anyMember }, async (request) => {
    const parsed = RunParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la evaluación.');
    return getRun(app.db, parsed.data.projectId, parsed.data.validationId);
  });
}
