import type { CriterionResult, ValidationRun } from '../../api/types';
import { es } from '../../i18n/es';
import { SourceBadge } from './SourceBadge';

const outcomeStyle = {
  MET: { icon: '✓', classes: 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  NOT_MET: { icon: '✗', classes: 'border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]' },
  NOT_APPLICABLE: { icon: '–', classes: 'border-[var(--color-border)] text-[var(--color-muted)]' },
} as const;

/** Estado general de la evaluación en icono y texto. */
export function RunStatusBadge({ status }: { status: ValidationRun['status'] }) {
  const style =
    status === 'PASSED'
      ? { icon: '✓', text: es.gate.passed, classes: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' }
      : status === 'FAILED'
        ? { icon: '✗', text: es.gate.failed, classes: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]' }
        : { icon: '⚠', text: es.gate.error, classes: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold ${style.classes}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.text}
    </span>
  );
}

function CriterionRow({ result, title }: { result: CriterionResult; title: string }) {
  const style = outcomeStyle[result.outcome];
  return (
    <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3" data-criterion={result.criterionId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-sm font-medium ${style.classes}`}>
          <span aria-hidden="true">{style.icon}</span>
          {es.gate.outcome[result.outcome]}
        </span>
        <strong>{title}</strong>
        <span className="font-mono text-xs text-[var(--color-muted)]">{result.criterionId}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span
          title={es.gate.origins[result.origin]}
          className={`rounded px-2 py-0.5 ${result.origin === 'OFFICIAL' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'}`}
        >
          {es.gate.origin[result.origin]}
        </span>
        <span className="text-[var(--color-muted)]">{result.mandatory ? es.gate.mandatory : es.gate.optional}</span>
        <SourceBadge source={result.source} />
      </p>
      {result.outcome === 'NOT_MET' ? (
        <div className="mt-2 space-y-1 text-sm">
          {result.evidence ? (
            <p>
              <strong>{es.gate.evidence}:</strong> {result.evidence}
            </p>
          ) : null}
          <p>
            <strong>{es.gate.why}:</strong> {result.explanation}
          </p>
          <p>
            <strong>{es.gate.howToFix}:</strong> {result.recommendation}
          </p>
        </div>
      ) : result.evidence ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{result.evidence}</p>
      ) : null}
    </li>
  );
}

interface Props {
  run: ValidationRun;
  /** Títulos de criterio por identificador (del catálogo). */
  titles: Record<string, string>;
}

/** Resultado de una evaluación: cada criterio con su estado, origen, evidencia y recomendación. */
export function GateResultPanel({ run, titles }: Props) {
  const met = run.results.filter((r) => r.outcome === 'MET').length;
  const notMet = run.results.filter((r) => r.outcome === 'NOT_MET').length;
  return (
    <section aria-label={es.gate.resultTitle} className="my-4">
      <h3 className="mb-2 flex flex-wrap items-center gap-3 text-lg font-semibold">
        {es.gate.resultTitle} <RunStatusBadge status={run.status} />
        <span className="text-sm font-normal text-[var(--color-muted)]">
          {es.gate.attempt} {run.attemptNo} · {es.gate.summary(met, notMet)}
        </span>
      </h3>
      <ul className="space-y-2">
        {run.results.map((result) => (
          <CriterionRow key={result.criterionId} result={result} title={titles[result.criterionId] ?? result.criterionId} />
        ))}
      </ul>
    </section>
  );
}
