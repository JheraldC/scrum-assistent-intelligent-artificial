import type { GateState } from '@scrum/shared';
import { es } from '../../i18n/es';

const style: Record<GateState, { icon: string; classes: string }> = {
  NO_EVALUADA: { icon: '○', classes: 'bg-[var(--color-border)] text-[var(--color-text)]' },
  APROBADA: { icon: '✓', classes: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  NO_APROBADA: { icon: '✗', classes: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]' },
  APROBADA_CON_EXCEPCION: { icon: '✓', classes: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  DESACTUALIZADA: { icon: '⟳', classes: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
};

/** Estado derivado de una compuerta, siempre en icono y texto. */
export function GateStateBadge({ state }: { state: GateState }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium ${style[state].classes}`}>
      <span aria-hidden="true">{style[state].icon}</span>
      {es.gate.state[state]}
    </span>
  );
}
