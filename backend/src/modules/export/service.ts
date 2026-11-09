import { AppError } from '../../platform/errors.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { ActivityRecorder } from '../activity/index.js';
import { CATALOG_VERSION } from '../validation/index.js';
import { toCsv } from './csv.js';
import { columnsFor, DATASETS, loadDataset, type DatasetName, type Row } from './datasets.js';

export const EXPORT_SCHEMA_VERSION = '1.0.0';

export interface ExportOptions {
  format: 'json' | 'csv';
  dataset?: DatasetName;
  includeSample: boolean;
  includeText: boolean;
}

export interface ExportResult {
  contentType: string;
  filename: string;
  body: string;
}

/**
 * Genera la exportación de un proyecto (FR-026 a FR-030). Reglas: solo seudónimos (nunca correo ni
 * datos de autenticación), sin valores inventados (lo ausente queda vacío o `null`), datos de
 * ejemplo excluidos por defecto y texto libre solo si se pide.
 */
export async function generateExport(db: Db, clock: Clock, actorId: string, projectId: string, options: ExportOptions): Promise<ExportResult> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound('No se encontró el proyecto.');
  if (project.isSample && !options.includeSample) {
    throw AppError.conflict('Este es un proyecto de demostración: sus datos no se exportan por defecto. Active «incluir datos de ejemplo» si realmente los necesita.');
  }

  const names = options.format === 'csv' ? [options.dataset!] : [...DATASETS];
  const loaded: Partial<Record<DatasetName, Row[]>> = {};
  for (const name of names) loaded[name] = await loadDataset(db, projectId, project.isSample, name, options.includeText);
  if (names.every((n) => (loaded[n] ?? []).length === 0) && options.format === 'json') {
    throw AppError.conflict('No hay datos para exportar todavía.');
  }

  const now = clock.now();
  await ActivityRecorder.record(db, {
    projectId,
    actorId,
    action: 'export.generated',
    entityType: 'project',
    entityId: projectId,
    // Solo metadatos de la exportación; nunca su contenido.
    payload: { format: options.format, dataset: options.dataset ?? null, includeSample: options.includeSample, includeText: options.includeText },
    occurredAt: now,
  });

  const stamp = now.toISOString().slice(0, 10);
  if (options.format === 'csv') {
    const dataset = options.dataset!;
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `${dataset}-${projectId}-${stamp}.csv`,
      body: toCsv(columnsFor(dataset, options.includeText), loaded[dataset] ?? []),
    };
  }
  return {
    contentType: 'application/json; charset=utf-8',
    filename: `export-${projectId}-${stamp}.json`,
    body: JSON.stringify(
      {
        schema_version: EXPORT_SCHEMA_VERSION,
        exported_at: now.toISOString(),
        project_id: projectId,
        is_sample: project.isSample,
        include_text: options.includeText,
        catalog_version: CATALOG_VERSION,
        datasets: loaded,
      },
      null,
      2,
    ),
  };
}
