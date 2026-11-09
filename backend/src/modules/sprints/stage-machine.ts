import type { StageStatus } from '@scrum/shared';

/**
 * Eventos que mueven una etapa (data-model.md, "Estados y transiciones: Etapa").
 * - start: la etapa comienza (primer registro).
 * - edit: se edita el artefacto de la etapa.
 * - gate_failed / gate_passed: resultado de una evaluación de compuerta.
 * - complete: el equipo cierra la etapa (la compuerta se comprueba antes, en `flow`).
 */
export type StageEvent = 'start' | 'edit' | 'gate_failed' | 'gate_passed' | 'complete';

/**
 * Siguiente estado de una etapa, o `null` si la transición no está permitida.
 * Función pura: no consulta datos ni reloj.
 */
export function nextStageStatus(current: StageStatus, event: StageEvent): StageStatus | null {
  switch (event) {
    case 'start':
      return current === 'PENDING' ? 'IN_PROGRESS' : null;
    case 'edit':
      // Editar una etapa validada obliga a reevaluar (NEEDS_CORRECTION).
      if (current === 'PENDING') return 'IN_PROGRESS';
      if (current === 'NEEDS_CORRECTION') return 'IN_PROGRESS';
      if (current === 'VALIDATED') return 'NEEDS_CORRECTION';
      return 'IN_PROGRESS';
    case 'gate_failed':
      return current === 'IN_PROGRESS' || current === 'NEEDS_CORRECTION' ? 'NEEDS_CORRECTION' : null;
    case 'gate_passed':
      if (current === 'NEEDS_CORRECTION') return 'IN_PROGRESS';
      return current === 'PENDING' ? null : current;
    case 'complete':
      return current === 'IN_PROGRESS' ? 'VALIDATED' : null;
  }
}
