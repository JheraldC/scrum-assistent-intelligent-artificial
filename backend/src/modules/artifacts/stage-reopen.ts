import type { Clock } from '../../platform/clock.js';
import type { Tx } from '../../platform/db.js';
import { applyStageEvent } from '../sprints/index.js';

/**
 * Registra actividad en una etapa sin compuerta bloqueante (seguimiento, Review): empieza si estaba
 * pendiente y vuelve a «en curso» si ya estaba cerrada (no queda bloqueada por una edición posterior).
 */
export async function touchStage(tx: Tx, clock: Clock, sprintId: string, stageType: 'TRACKING' | 'REVIEW'): Promise<void> {
  const stage = await applyStageEvent(tx, clock, sprintId, stageType, 'edit');
  if (stage?.status === 'NEEDS_CORRECTION') await applyStageEvent(tx, clock, sprintId, stageType, 'edit');
}
