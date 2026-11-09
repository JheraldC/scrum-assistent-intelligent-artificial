import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvidenceInputSchema, StageTypeSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { addEvidence, createSprint, getSprint, listEvidence, listSprints } from './service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });
const StageParams = SprintParams.extend({ stageType: StageTypeSchema });

function parseParams<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el recurso solicitado.');
  return parsed.data;
}

export async function sprintsRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];

  app.get('/projects/:projectId/sprints', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return listSprints(app.db, projectId);
  });

  app.post(
    '/projects/:projectId/sprints',
    { preHandler: [requireAuth, requireProjectRole('FACILITATOR')] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const sprint = await createSprint(app.db, app.clock, request.user!.id, projectId);
      return reply.status(201).send(sprint);
    },
  );

  app.get('/projects/:projectId/sprints/:sprintId', { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parseParams(SprintParams, request.params);
    return getSprint(app.db, projectId, sprintId);
  });

  app.get(
    '/projects/:projectId/sprints/:sprintId/stages/:stageType/evidence',
    { preHandler: anyMember },
    async (request) => {
      const { projectId, sprintId, stageType } = parseParams(StageParams, request.params);
      return listEvidence(app.db, projectId, sprintId, stageType);
    },
  );

  app.post(
    '/projects/:projectId/sprints/:sprintId/stages/:stageType/evidence',
    { preHandler: anyMember },
    async (request, reply) => {
      const { projectId, sprintId, stageType } = parseParams(StageParams, request.params);
      const { content } = EvidenceInputSchema.parse(request.body);
      const evidence = await addEvidence(app.db, app.clock, request.user!.id, projectId, sprintId, stageType, content);
      return reply.status(201).send(evidence);
    },
  );
}
