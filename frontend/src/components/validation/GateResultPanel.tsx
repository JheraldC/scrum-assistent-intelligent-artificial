import { useState } from 'react';
import { api } from '../../api/client';
import type { CriterionResult, ValidationRun } from '../../api/types';
import { Button } from '../ui/Button';
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

function CriterionRow({ result, title, compact }: { result: CriterionResult; title: string; compact?: boolean }) {
  const style = outcomeStyle[result.outcome];
  if (compact) {
    // En el panel del asistente: lo esencial en pocas líneas (qué falla, por qué y cómo corregirlo).
    return (
      <li className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm" data-criterion={result.criterionId}>
        <p className="font-medium">
          <span className={`mr-1 inline-flex items-center rounded border px-1 text-xs ${style.classes}`}>
            <span aria-hidden="true">{style.icon}</span>
            <span className="sr-only">{es.gate.outcome[result.outcome]}</span>
          </span>
          {title}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {result.criterionId} · {es.gate.origin[result.origin]} · {result.mandatory ? es.gate.mandatory : es.gate.optional} · {es.gate.ruleCheck}
        </p>
        {result.outcome === 'NOT_MET' ? (
          <>
            {result.evidence ? (
              <p className="mt-1">
                <strong>{es.gate.evidence}:</strong> {result.evidence}
              </p>
            ) : null}
            <p className="mt-1">
              <strong>{es.gate.why}:</strong> {result.explanation}
            </p>
            <p>
              <strong>{es.gate.howToFix}:</strong> {result.recommendation}
            </p>
          </>
        ) : null}
      </li>
    );
  }
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
  /** Con estos dos datos se muestra el botón «Pedir recomendación de IA» (bajo demanda). */
  projectId?: string;
  onRunUpdated?: (run: ValidationRun) => void;
  /** En el panel del asistente no se repite la sección de IA: las recomendaciones se piden aparte. */
  hideAi?: boolean;
  /** Vista compacta: los criterios incumplidos a la vista y los cumplidos plegados. */
  compact?: boolean;
}

/** Observaciones de IA de una evaluación: siempre etiquetadas y separadas de las reglas (FR-022). */
function AiSection({ run, projectId, onRunUpdated }: Pick<Props, 'run' | 'projectId' | 'onRunUpdated'>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failedNotice = es.ai.statusNotice[run.aiStatus];

  async function request() {
    if (!projectId || !onRunUpdated) return;
    setBusy(true);
    setError(null);
    try {
      onRunUpdated(await api<ValidationRun>(`/projects/${projectId}/validations/${run.id}/ai-feedback`, { method: 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : es.assistant.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={es.ai.recommendations} className="mt-4 rounded-md border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-3 text-[var(--color-ai)]">
      <h4 className="flex flex-wrap items-center gap-2 font-semibold">
        {es.ai.recommendations} <SourceBadge source="AI_RECOMMENDATION" />
      </h4>
      <p className="text-xs">{es.assistant.notGuaranteed}</p>
      {run.aiObservations.length > 0 ? (
        <ul className="mt-2 space-y-2 text-sm">
          {run.aiObservations.map((o, i) => (
            <li key={i}>
              {o.criterionId ? <span className="mr-2 font-mono text-xs">{o.criterionId}</span> : null}
              {o.text}
              {o.suggestedRewrite ? (
                <p className="mt-1 rounded bg-[var(--color-surface)] p-2 text-[var(--color-text)]">
                  <strong>{es.ai.suggestedRewrite}:</strong> {o.suggestedRewrite}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : run.aiStatus === 'OK' ? (
        <p className="mt-2 text-sm">{es.ai.none}</p>
      ) : null}
      {failedNotice ? (
        <p role="status" className="mt-2 text-sm font-medium">
          <span aria-hidden="true">⚠ </span>
          {failedNotice} {es.ai.rulesStillValid}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
      {projectId && onRunUpdated ? (
        <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => void request()}>
          {busy ? es.ai.requesting : es.ai.request}
        </Button>
      ) : null}
    </section>
  );
}

/** Resultado de una evaluación: cada criterio con su estado, origen, evidencia y recomendación. */
export function GateResultPanel({ run, titles, projectId, onRunUpdated, hideAi, compact }: Props) {
  const met = run.results.filter((r) => r.outcome === 'MET').length;
  const notMet = run.results.filter((r) => r.outcome === 'NOT_MET').length;
  return (
    <section aria-label={es.gate.resultTitle} className="my-4">
      <h3 className={`mb-2 flex flex-wrap items-center gap-2 font-semibold ${compact ? 'text-base' : 'text-lg'}`}>
        {es.gate.resultTitle} <RunStatusBadge status={run.status} />
        <span className="text-sm font-normal text-[var(--color-muted)]">
          {es.gate.attempt} {run.attemptNo} · {es.gate.summary(met, notMet)}
        </span>
      </h3>
      {compact ? (
        <>
          <ul className="space-y-2">
            {run.results
              .filter((r) => r.outcome === 'NOT_MET')
              .map((result) => (
                <CriterionRow compact key={result.criterionId} result={result} title={titles[result.criterionId] ?? result.criterionId} />
              ))}
          </ul>
          {met + run.results.filter((r) => r.outcome === 'NOT_APPLICABLE').length > 0 ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer select-none text-[var(--color-muted)]">
                {es.panel.passedCriteria(run.results.filter((r) => r.outcome !== 'NOT_MET').length)}
              </summary>
              <ul className="mt-2 space-y-2">
                {run.results
                  .filter((r) => r.outcome !== 'NOT_MET')
                  .map((result) => (
                    <CriterionRow compact key={result.criterionId} result={result} title={titles[result.criterionId] ?? result.criterionId} />
                  ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <ul className="space-y-2">
          {run.results.map((result) => (
            <CriterionRow key={result.criterionId} result={result} title={titles[result.criterionId] ?? result.criterionId} />
          ))}
        </ul>
      )}
      {hideAi ? null : <AiSection run={run} projectId={projectId} onRunUpdated={onRunUpdated} />}
    </section>
  );
}
