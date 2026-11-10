import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DocumentUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { readUpload } from '../../platform/uploads.js';
import { requireAuth } from '../auth/index.js';
import { addVersion, createDocument, getFile, listDocuments, listVersions, MAX_DOCUMENT_BYTES, updateDocument } from './service.js';

const DocParams = z.object({ projectId: z.uuid(), documentId: z.uuid() });
const DownloadQuery = z.object({ version: z.coerce.number().int().positive().optional() });

function parse<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el documento.');
  return parsed.data;
}

/**
 * Documentación permanente del proyecto (opcional). Cualquier miembro la consulta; solo el
 * Facilitador la sube, reemplaza o marca, porque su contenido puede enviarse al proveedor de IA.
 */
export async function documentsRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const facilitator = [requireAuth, requireProjectRole('FACILITATOR')];
  const base = '/projects/:projectId/documents';

  app.get(base, { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return listDocuments(app.db, projectId);
  });

  app.post(base, { preHandler: facilitator }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { fields, file } = await readUpload(request, MAX_DOCUMENT_BYTES);
    if (!file) throw AppError.validation('Seleccione un archivo.', [{ field: 'file', message: 'Seleccione un archivo.' }]);
    const doc = await createDocument(app.db, app.clock, request.user!.id, projectId, { name: fields.name, fileName: file.fileName, data: file.data });
    return reply.status(201).send(doc);
  });

  app.get(`${base}/:documentId/versions`, { preHandler: anyMember }, async (request) => {
    const { projectId, documentId } = parse(DocParams, request.params);
    return listVersions(app.db, projectId, documentId);
  });

  app.post(`${base}/:documentId/versions`, { preHandler: facilitator }, async (request, reply) => {
    const { projectId, documentId } = parse(DocParams, request.params);
    const { file } = await readUpload(request, MAX_DOCUMENT_BYTES);
    if (!file) throw AppError.validation('Seleccione un archivo.', [{ field: 'file', message: 'Seleccione un archivo.' }]);
    return reply.status(201).send(await addVersion(app.db, app.clock, request.user!.id, projectId, documentId, { fileName: file.fileName, data: file.data }));
  });

  app.patch(`${base}/:documentId`, { preHandler: facilitator }, async (request) => {
    const { projectId, documentId } = parse(DocParams, request.params);
    return updateDocument(app.db, app.clock, request.user!.id, projectId, documentId, DocumentUpdateSchema.parse(request.body));
  });

  // Descarga: siempre como adjunto y con tipo fijo (nunca se interpreta en el navegador).
  app.get(`${base}/:documentId/file`, { preHandler: anyMember }, async (request, reply) => {
    const { projectId, documentId } = parse(DocParams, request.params);
    const { version } = DownloadQuery.parse(request.query);
    const file = await getFile(app.db, projectId, documentId, version);
    return reply
      .header('content-type', file.mimeType)
      .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'private, no-store')
      .send(file.data);
  });
}
