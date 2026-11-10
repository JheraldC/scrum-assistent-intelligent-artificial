import { useState } from 'react';
import type { FieldRecommendation, Recommendation, ResolvedSuggestion, ValidationRun } from '../../api/types';
import { useCatalogTitles } from '../../api/useCatalogTitles';
import { es } from '../../i18n/es';
import { Button } from '../ui/Button';
import { GateResultPanel, RunStatusBadge } from '../validation/GateResultPanel';
import { SourceBadge } from '../validation/SourceBadge';
import type { ArtifactRef, PanelMessage } from './AssistantContext';
import { SuggestionCard } from './SuggestionCard';

type EvaluationMessage = Extract<PanelMessage, { kind: 'evaluation' }>;
type RecommendationMessage = Extract<PanelMessage, { kind: 'recommendation' }>;

/** Qué datos y documentos se enviaron al proveedor para responder. */
export function ContextUsed({ used }: { used: Recommendation['contextUsed'] }) {
  return (
    <details className="mt-1 text-xs">
      <summary className="min-h-6 cursor-pointer">{es.panel.contextUsed}</summary>
      <ul className="mt-1 list-disc pl-5">
        {used.projectData.map((d) => (
          <li key={d}>{d}</li>
        ))}
        {used.focus ? <li>{used.focus}</li> : null}
      </ul>
      <p className="mt-1">
        {es.panel.contextDocs}:{' '}
        {used.documents.length > 0 ? used.documents.map((d) => `«${d.document}» (${d.sections.join(', ')})`).join('; ') : es.panel.contextNoDocs}
      </p>
    </details>
  );
}

const show = (value: string | string[]) => {
  const text = Array.isArray(value) ? value.map((v) => `• ${v}`).join('\n') : value;
  return text.trim() === '' ? es.panel.empty : text;
};

/**
 * Resultado de una evaluación por REGLAS mostrado en el conversación del panel. Es determinista y no usa IA:
 * la última de cada objetivo se muestra completa y las anteriores quedan como una línea.
 */
export function EvaluationCard({ message, onRecommend }: { message: EvaluationMessage; onRecommend: (artifact: ArtifactRef) => void }) {
  const titles = useCatalogTitles();
  const { run, label, artifact, superseded } = message;
  if (superseded) {
    return (
      <p className="text-xs text-[var(--color-muted)]" data-evaluation-old>
        {es.panel.evaluationCompact} · {label} · {es.gate.attempt} {run.attemptNo}: <RunStatusBadge status={run.status} />
      </p>
    );
  }
  return (
    <div data-evaluation={run.targetId} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <p className="text-xs font-medium text-[var(--color-muted)]">
        {es.panel.evaluationRules} · {label}
      </p>
      <GateResultPanel run={run} titles={titles} hideAi />
      {artifact ? (
        <Button variant="secondary" onClick={() => onRecommend(artifact)}>
          {es.panel.recommendHere}
        </Button>
      ) : null}
    </div>
  );
}

const statusStyle: Record<FieldRecommendation['status'], { icon: string; classes: string }> = {
  CHANGE: { icon: '✎', classes: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  NO_CHANGE: { icon: '✓', classes: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  UNSURE: { icon: '?', classes: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  NO_RESPONSE: { icon: '–', classes: 'bg-[var(--color-border)] text-[var(--color-text)]' },
};

function Basis({ field }: { field: FieldRecommendation }) {
  const parts: string[] = [];
  if (field.basis === 'REGLAS') parts.push(`${es.panel.basisLabels.REGLAS}: ${field.criterionIds.join(', ')}`);
  else if (field.basis === 'DOCUMENTO') parts.push(`${es.panel.basisLabels.DOCUMENTO}: ${field.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ')}`);
  else parts.push(es.panel.basisLabels.INFERENCIA);
  return <p className="text-xs">{parts.join(' ')}</p>;
}

/**
 * Recomendación de IA por campo. Cada campo editable muestra su estado: cambio recomendado (con valor
 * actual y propuesto), sin cambios recomendados, sin certeza o «el modelo no se pronunció».
 */
export function RecommendationCard({ message, projectId, onResolved }: { message: RecommendationMessage; projectId: string; onResolved: (r: ResolvedSuggestion) => void }) {
  const { rec, label, superseded } = message;
  const [resolved, setResolved] = useState<Record<string, 'ACCEPTED' | 'DISCARDED'>>({});
  if (superseded) {
    return (
      <p className="text-xs text-[var(--color-muted)]" data-recommendation-old>
        {es.panel.recSummary} anterior · {label}
      </p>
    );
  }
  return (
    <section aria-label={`${es.ai.recommendations}: ${label}`} data-recommendation={rec.artifact.id} className="rounded-md border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-ai)]">
      <p className="mb-1 flex flex-wrap items-center gap-2">
        <SourceBadge source="AI_RECOMMENDATION" />
        <strong className="text-[var(--color-text)]">{label}</strong>
      </p>
      <p className="text-xs">{rec.kind === 'AI_ONLY' ? es.panel.recAdvisory : es.panel.recRules}</p>
      {rec.summary ? (
        <p className="mt-1">
          <strong>{es.panel.recSummary}:</strong> {rec.summary}
        </p>
      ) : null}
      {rec.fields.length === 0 ? <p className="mt-1">{es.panel.recNoFields}</p> : null}

      <ul className="mt-2 space-y-2">
        {rec.fields.map((f) => {
          const style = statusStyle[f.status];
          const done = f.suggestion ? resolved[f.suggestion.id] : undefined;
          return (
            <li key={f.field} data-field={f.field} data-status={f.status} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-text)]">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {f.label}
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${style.classes}`}>
                  <span aria-hidden="true">{style.icon}</span>
                  {es.panel.statusLabels[f.status]}
                </span>
              </p>
              {f.status === 'CHANGE' && f.suggestion ? (
                done ? (
                  <p className="mt-1 text-xs">{done === 'ACCEPTED' ? es.panel.resolvedAccepted : es.panel.resolvedDiscarded}</p>
                ) : (
                  <ul className="mt-1">
                    <SuggestionCard
                      projectId={projectId}
                      suggestion={f.suggestion}
                      onResolved={(r) => {
                        setResolved((prev) => ({ ...prev, [r.suggestion.id]: r.suggestion.status === 'ACCEPTED' ? 'ACCEPTED' : 'DISCARDED' }));
                        onResolved(r);
                      }}
                    />
                  </ul>
                )
              ) : (
                <>
                  <p className="mt-1 text-xs">
                    <strong>{es.panel.current}:</strong> <span className="whitespace-pre-wrap">{show(f.currentValue)}</span>
                  </p>
                  {f.rationale ? <p className="mt-1 text-xs">{f.rationale}</p> : null}
                </>
              )}
              {f.status === 'CHANGE' || f.status === 'NO_CHANGE' ? <Basis field={f} /> : null}
            </li>
          );
        })}
      </ul>

      {rec.questions.length > 0 ? (
        <>
          <h4 className="mt-2 font-semibold">{es.panel.recQuestions}</h4>
          <ul className="list-disc pl-5">
            {rec.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      ) : null}
      <ContextUsed used={rec.contextUsed} />
      <p className="mt-1 text-xs">{rec.disclaimer}</p>
      <p className="text-xs opacity-80">
        {es.assistant.model}: {rec.model}
      </p>
    </section>
  );
}

export type { ValidationRun };
