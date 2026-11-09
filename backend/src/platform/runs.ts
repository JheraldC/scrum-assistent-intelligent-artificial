import type { TargetType } from '@scrum/shared';
import type { Tx } from './db.js';

export interface LatestRunRow {
  targetId: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  targetVersion: number;
  attemptNo: number;
}

/**
 * Última evaluación (mayor intento) de cada objetivo, sin importar qué módulo la pidió.
 * Con ella se deriva el estado de compuerta de artefactos (backlog, Sprint...).
 */
export async function latestRuns(
  db: Tx,
  projectId: string,
  targetType: TargetType,
  targetIds: string[],
): Promise<Map<string, LatestRunRow>> {
  const latest = new Map<string, LatestRunRow>();
  if (targetIds.length === 0) return latest;
  const rows = await db.validationRun.findMany({
    where: { projectId, targetType, targetId: { in: targetIds } },
    orderBy: { attemptNo: 'desc' },
    select: { targetId: true, status: true, targetVersion: true, attemptNo: true },
  });
  for (const row of rows) if (!latest.has(row.targetId)) latest.set(row.targetId, row);
  return latest;
}
