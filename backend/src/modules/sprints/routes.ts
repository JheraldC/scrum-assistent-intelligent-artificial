import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvidenceInputSchema, SprintItemsSchema, SprintUpdateSchema, StageTypeSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { addEvidence, createSprint, getEvidenceFile, getSprint, listEvidence, listSprints, setSprintItems, updateSprint } from './service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });
const StageParams = SprintParams.extend({ stageType: StageTypeSchema });
const EvidenceParams = StageParams.extend({ evidenceId: z.uuid() });

export function parseParams<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
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

  app.patch('/projects/:projectId/sprints/:sprintId', { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parseParams(SprintParams, request.params);
    const input = SprintUpdateSchema.parse(request.body);
    return updateSprint(app.db, app.clock, request.user!.id, projectId, sprintId, input);
  });

  app.put('/projects/:projectId/sprints/:sprintId/items', { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parseParams(SprintParams, request.params);
    const input = SprintItemsSchema.parse(request.body);
    return setSprintItems(app.db, app.clock, request.user!.id, projectId, sprintId, input);
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

  // La subida de archivos como evidencia se retiró; solo se conserva la descarga de los adjuntos ya guardados.
  app.get(
    '/projects/:projectId/sprints/:sprintId/stages/:stageType/evidence/:evidenceId/file',
    { preHandler: anyMember },
    async (request, reply) => {
      const { projectId, sprintId, stageType, evidenceId } = parseParams(EvidenceParams, request.params);
      const file = await getEvidenceFile(app.db, projectId, sprintId, stageType, evidenceId);
      return reply
        .header('content-type', file.mimeType)
        .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', 'private, no-store')
        .send(file.data);
    },
  );
}
