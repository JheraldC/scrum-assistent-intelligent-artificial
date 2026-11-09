import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SprintReviewUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../../platform/access.js';
import { AppError } from '../../../platform/errors.js';
import { requireAuth } from '../../auth/index.js';
import { getReview, updateReview } from './service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });

function parse(params: unknown) {
  const parsed = SprintParams.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el recurso solicitado.');
  return parsed.data;
}

/** Sprint Review: resultados, incremento, retroalimentación y valoración del Sprint Goal (FR-039). */
export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const url = '/projects/:projectId/sprints/:sprintId/review';

  app.get(url, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(request.params);
    return getReview(app.db, projectId, sprintId);
  });

  app.put(url, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(request.params);
    const input = SprintReviewUpdateSchema.parse(request.body);
    return updateReview(app.db, app.clock, request.user!.id, projectId, sprintId, input);
  });
}
