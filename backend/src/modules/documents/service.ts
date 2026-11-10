import type { DocumentUpdate } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { DOCUMENT_TYPES, MB, validateUpload } from '../../platform/uploads.js';
import { ActivityRecorder } from '../activity/index.js';
import { splitSections, type DocSection } from './sections.js';

export const MAX_DOCUMENT_BYTES = 2 * MB;
export const MAX_DOCUMENTS_PER_PROJECT = 30;

/** Metadatos de la versión, sin el contenido binario. */
const versionSelect = {
  version: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  textContent: true,
  uploader: { select: { pseudonym: true } },
} as const;

interface VersionMeta {
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  textContent: string | null;
  uploader: { pseudonym: string };
}

const versionDto = (v: VersionMeta) => ({
  version: v.version,
  fileName: v.fileName,
  mimeType: v.mimeType.split(';')[0]!,
  sizeBytes: v.sizeBytes,
  uploadedAt: v.uploadedAt.toISOString(),
  uploadedByPseudonym: v.uploader.pseudonym,
  // Solo los documentos de texto pueden usarse como contexto de IA (no se extrae texto de PDF).
  usableAsContext: v.textContent !== null,
});

interface DocRow {
  id: string;
  name: string;
  status: 'ACTIVE' | 'OUTDATED';
  includeInContext: boolean;
  currentVersion: number;
  updatedAt: Date;
  versions: VersionMeta[];
}

const docDto = (d: DocRow) => {
  const current = d.versions.find((v) => v.version === d.currentVersion) ?? d.versions[0]!;
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    includeInContext: d.includeInContext,
    currentVersion: d.currentVersion,
    updatedAt: d.updatedAt.toISOString(),
    current: versionDto(current),
  };
};

const withVersions = { versions: { select: versionSelect, orderBy: { version: 'desc' as const } } };

export async function listDocuments(db: Db, projectId: string) {
  const rows = await db.projectDocument.findMany({ where: { projectId }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], include: withVersions });
  return rows.map(docDto);
}

export async function listVersions(db: Db, projectId: string, documentId: string) {
  const doc = await db.projectDocument.findFirst({ where: { id: documentId, projectId }, include: withVersions });
  if (!doc) throw AppError.notFound('No se encontró el documento.');
  return doc.versions.map(versionDto);
}

export async function createDocument(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  upload: { name?: string; fileName: string; data: Buffer },
) {
  const file = validateUpload(upload.fileName, upload.data, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);
  const name = (upload.name?.trim() || file.fileName).slice(0, 120);
  return withTransaction(db, async (tx) => {
    const count = await tx.projectDocument.count({ where: { projectId } });
    if (count >= MAX_DOCUMENTS_PER_PROJECT) {
      throw AppError.conflict(`El proyecto ya tiene ${MAX_DOCUMENTS_PER_PROJECT} documentos. Reemplace o desactualice alguno.`);
    }
    const now = clock.now();
    const doc = await tx.projectDocument.create({
      data: {
        projectId,
        name,
        // Si no hay texto utilizable, el documento se guarda como referencia y no entra al contexto de IA.
        includeInContext: file.text !== null,
        createdAt: now,
        updatedAt: now,
        versions: {
          create: {
            version: 1,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            data: new Uint8Array(file.data),
            textContent: file.text,
            uploadedBy: actorId,
            uploadedAt: now,
          },
        },
      },
      include: withVersions,
    });
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'document.created', entityType: 'project_document', entityId: doc.id, payload: { version: 1 }, occurredAt: now });
    return docDto(doc);
  });
}

/** Reemplaza el contenido creando una versión nueva (las anteriores se conservan). */
export async function addVersion(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  documentId: string,
  upload: { fileName: string; data: Buffer },
) {
  const file = validateUpload(upload.fileName, upload.data, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);
  return withTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "project_document" WHERE id = ${documentId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
    const doc = await tx.projectDocument.findFirst({ where: { id: documentId, projectId } });
    if (!doc) throw AppError.notFound('No se encontró el documento.');
    const now = clock.now();
    const version = doc.currentVersion + 1;
    await tx.projectDocumentVersion.create({
      data: {
        documentId,
        version,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        data: new Uint8Array(file.data),
        textContent: file.text,
        uploadedBy: actorId,
        uploadedAt: now,
      },
    });
    const updated = await tx.projectDocument.update({
      where: { id: documentId },
      data: { currentVersion: version, status: 'ACTIVE', includeInContext: file.text !== null ? doc.includeInContext : false, updatedAt: now },
      include: withVersions,
    });
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'document.version_added', entityType: 'project_document', entityId: documentId, payload: { version }, occurredAt: now });
    return docDto(updated);
  });
}

export async function updateDocument(db: Db, clock: Clock, actorId: string, projectId: string, documentId: string, input: DocumentUpdate) {
  return withTransaction(db, async (tx) => {
    const doc = await tx.projectDocument.findFirst({ where: { id: documentId, projectId }, include: withVersions });
    if (!doc) throw AppError.notFound('No se encontró el documento.');
    const current = doc.versions.find((v) => v.version === doc.currentVersion);
    if (input.includeInContext === true && current?.textContent == null) {
      throw AppError.validation('Este documento no tiene texto utilizable, así que no puede usarse como contexto de la IA.', [
        { field: 'includeInContext', message: 'Solo los documentos de texto (.md, .txt) pueden usarse como contexto.' },
      ]);
    }
    const now = clock.now();
    const updated = await tx.projectDocument.update({
      where: { id: documentId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.includeInContext !== undefined ? { includeInContext: input.includeInContext } : {}),
        updatedAt: now,
      },
      include: withVersions,
    });
    await ActivityRecorder.record(tx, { projectId, actorId, action: 'document.updated', entityType: 'project_document', entityId: documentId, occurredAt: now });
    return docDto(updated);
  });
}

export async function getFile(db: Db, projectId: string, documentId: string, version?: number) {
  const doc = await db.projectDocument.findFirst({ where: { id: documentId, projectId } });
  if (!doc) throw AppError.notFound('No se encontró el documento.');
  const row = await db.projectDocumentVersion.findUnique({ where: { documentId_version: { documentId, version: version ?? doc.currentVersion } } });
  if (!row) throw AppError.notFound('No se encontró esa versión del documento.');
  return { fileName: row.fileName, mimeType: row.mimeType, data: Buffer.from(row.data) };
}

export interface ContextDocument {
  name: string;
  version: number;
  sections: DocSection[];
}

/** Documentos vigentes que la IA puede consultar: activos, marcados para el contexto y con texto. */
export async function contextDocuments(db: Db, projectId: string): Promise<ContextDocument[]> {
  const docs = await db.projectDocument.findMany({
    where: { projectId, status: 'ACTIVE', includeInContext: true },
    orderBy: { name: 'asc' },
    include: { versions: { select: { version: true, fileName: true, textContent: true }, orderBy: { version: 'desc' } } },
  });
  return docs.flatMap((d) => {
    const current = d.versions.find((v) => v.version === d.currentVersion);
    if (!current || current.textContent === null) return [];
    return [{ name: d.name, version: current.version, sections: splitSections(current.textContent, current.fileName) }];
  });
}
