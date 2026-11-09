import type { ReactNode } from 'react';
import { STAGE_TYPES, type StageStatus, type StageType } from '@scrum/shared';
import type { Stage } from '../../api/types';
import { es } from '../../i18n/es';
import { GateStateBadge } from '../validation/GateStateBadge';

const statusStyle: Record<StageStatus, { icon: string; classes: string }> = {
  PENDING: { icon: '○', classes: 'border-[var(--color-border)] text-[var(--color-muted)]' },
  IN_PROGRESS: { icon: '◔', classes: 'border-[var(--color-info)] bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  NEEDS_CORRECTION: { icon: '⚠', classes: 'border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  VALIDATED: { icon: '✓', classes: 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]' },
};

interface Props {
  stages: Stage[];
  /** Contenido extra por etapa (evidencia, compuerta...). */
  renderStage?: (stage: Stage) => ReactNode;
}

/** Flujo visual del Sprint: cada etapa con su estado en icono y texto (no solo color). */
export function StageStepper({ stages, renderStage }: Props) {
  const byType = new Map<StageType, Stage>(stages.map((s) => [s.type, s]));
  return (
    <ol className="grid gap-4 lg:grid-cols-2" aria-label={es.flow.title}>
      {STAGE_TYPES.map((type, index) => {
        const stage = byType.get(type);
        if (!stage) return null;
        const style = statusStyle[stage.status];
        const text = es.flow.stages[type];
        return (
          <li key={type} className={`rounded-md border-2 p-4 ${style.classes}`} data-stage={type} data-status={stage.status}>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              {index + 1}. {text.name}
            </h3>
            <p className="my-1 font-medium">
              <span aria-hidden="true">{style.icon} </span>
              {es.flow.stageStatus[stage.status]}
            </p>
            <p className="text-sm text-[var(--color-text)]">{text.help}</p>
            {stage.gateState ? (
              <p className="mt-2 text-[var(--color-text)]">
                <GateStateBadge state={stage.gateState} />
              </p>
            ) : null}
            {renderStage ? <div className="mt-3 text-[var(--color-text)]">{renderStage(stage)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
