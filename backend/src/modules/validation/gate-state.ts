import type { GateState } from '@scrum/shared';

export interface LatestRun {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  targetVersion: number;
  hasException: boolean;
}

/**
 * Estado derivado de una compuerta para la versión actual del objetivo (data-model.md).
 * No depende de la IA: un error del motor o de la IA nunca produce APROBADA.
 */
export function deriveGateState(latest: LatestRun | null, currentVersion: number): GateState {
  if (!latest) return 'NO_EVALUADA';
  if (latest.targetVersion !== currentVersion) return 'DESACTUALIZADA';
  if (latest.status === 'PASSED') return 'APROBADA';
  if (latest.status === 'FAILED' && latest.hasException) return 'APROBADA_CON_EXCEPCION';
  return 'NO_APROBADA';
}
