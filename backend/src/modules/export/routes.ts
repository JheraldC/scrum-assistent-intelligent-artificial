import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../../platform/access.js';
import { requireAuth } from '../auth/index.js';
import { DATASETS } from './datasets.js';
import { generateExport } from './service.js';

const boolParam = z
  .enum(['true', 'false'], 'Debe ser true o false.')
  .optional()
  .transform((v) => v === 'true');

const ExportQuery = z
  .object({
    format: z.enum(['json', 'csv'], 'El formato debe ser json o csv.'),
    dataset: z.enum(DATASETS, 'Conjunto de datos desconocido.').optional(),
    includeSample: boolParam,
    includeText: boolParam,
  })
  .refine((q) => q.format !== 'csv' || q.dataset !== undefined, {
    message: 'Con el formato csv debe indicar el conjunto de datos.',
    path: ['dataset'],
  });

/** Exportación de datos del proyecto (solo Facilitador): GET /projects/:projectId/export. */
export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/projects/:projectId/export',
    { preHandler: [requireAuth, requireProjectRole('FACILITATOR')] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const query = ExportQuery.parse(request.query);
      const result = await generateExport(app.db, app.clock, request.user!.id, projectId, {
        format: query.format,
        dataset: query.dataset,
        includeSample: query.includeSample,
        includeText: query.includeText,
      });
      return reply
        .header('content-type', result.contentType)
        .header('content-disposition', `attachment; filename="${result.filename}"`)
        .header('cache-control', 'no-store')
        .send(result.body);
    },
  );
}
