import { useState } from 'react';
import type { AgentReply, FieldRecommendation, Recommendation, ResolvedSuggestion } from '../../api/types';
import { useCatalogTitles } from '../../api/useCatalogTitles';
import { es } from '../../i18n/es';
import { Button } from '../ui/Button';
import { GateResultPanel, RunStatusBadge } from '../validation/GateResultPanel';
import type { ArtifactRef, PanelMessage } from './AssistantContext';
import { SuggestionCard } from './SuggestionCard';

type EvaluationMessage = Extract<PanelMessage, { kind: 'evaluation' }>;
type RecommendationMessage = Extract<PanelMessage, { kind: 'recommendation' }>;

interface DetailsProps {
  used: Recommendation['contextUsed'];
  disclaimer: string;
  model: string;
  /** Líneas adicionales (respaldo, criterios mencionados…). */
  extra?: string[];
}

/** Todo lo secundario de una respuesta (contexto usado, aviso, modelo) plegado en un solo «Detalles». */
export function ReplyDetails({ used, disclaimer, model, extra = [] }: DetailsProps) {
  return (
    <details className="mt-2 text-xs text-[var(--color-muted)]">
      <summary className="cursor-pointer select-none">{es.panel.details}</summary>
      <div className="mt-1 space-y-1">
        {extra.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>
          {es.panel.contextUsed}: {[...used.projectData, ...(used.focus ? [used.focus] : [])].join(' · ')}
        </p>
        <p>
          {es.panel.contextDocs}: {used.documents.length > 0 ? used.documents.map((d) => `«${d.document}» (${d.sections.join(', ')})`).join('; ') : es.panel.contextNoDocs}
        </p>
        <p>{disclaimer}</p>
        <p>
          {es.assistant.model}: {model}
        </p>
      </div>
    </details>
  );
}

/** Respuesta de chat de la IA: texto, sugerencias y lo demás plegado. */
export function ChatReplyCard({ reply }: { reply: AgentReply }) {
  const basis =
    reply.basis === 'DOCUMENTO' ? `${es.panel.sources}: ${reply.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ')}` : `${es.panel.sources}: ${es.panel.basisInference}`;
  const criteria = reply.referencedCriteria.length > 0 ? [`${es.assistant.criteria}: ${reply.referencedCriteria.join(', ')}`] : [];
  return (
    <div data-ai-reply className="mr-6 rounded-lg rounded-tl-none border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-text)]">
      <p className="mb-1 text-xs font-semibold text-[var(--color-ai)]">
        <span aria-hidden="true">✦ </span>
        {es.gate.aiRecommendation}
      </p>
      <p className="whitespace-pre-wrap">{reply.answer}</p>
      {reply.suggestions.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {reply.suggestions.map((s, i) => (
            <li key={i}>
              {s.target ? <span className="font-mono text-xs">{s.target}: </span> : null}
              {s.text}
            </li>
          ))}
        </ul>
      ) : null}
      <ReplyDetails used={reply.contextUsed} disclaimer={reply.disclaimer} model={reply.model} extra={[basis, ...criteria]} />
    </div>
  );
}

/**
 * Resultado de una evaluación por REGLAS (determinista, sin IA). La más reciente se muestra con los
 * criterios incumplidos a la vista y los cumplidos plegados; las anteriores quedan en una línea.
 */
export function EvaluationCard({ message, onRecommend }: { message: EvaluationMessage; onRecommend: (artifact: ArtifactRef) => void }) {
  const titles = useCatalogTitles();
  const { run, label, artifact, superseded } = message;
  if (superseded) {
    return (
      <p className="text-xs text-[var(--color-muted)]" data-evaluation-old>
        {label} · {es.gate.attempt} {run.attemptNo}: <RunStatusBadge status={run.status} />
      </p>
    );
  }
  return (
    <div data-evaluation={run.targetId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <p className="text-xs font-medium text-[var(--color-muted)]">
        {es.panel.evaluationRules} · {label}
      </p>
      <GateResultPanel run={run} titles={titles} hideAi compact />
      {artifact ? (
        <Button size="sm" variant="secondary" onClick={() => onRecommend(artifact)}>
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

function basisText(field: FieldRecommendation): string {
  if (field.basis === 'REGLAS') return `${es.panel.basisLabels.REGLAS}: ${field.criterionIds.join(', ')}`;
  if (field.basis === 'DOCUMENTO') return `${es.panel.basisLabels.DOCUMENTO}: ${field.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ')}`;
  return es.panel.basisLabels.INFERENCIA;
}

/**
 * Recomendación de IA por campo. Cada campo editable muestra su estado en una línea; solo los cambios
 * recomendados se despliegan con el valor actual, el propuesto y las acciones.
 */
export function RecommendationCard({ message, projectId, onResolved }: { message: RecommendationMessage; projectId: string; onResolved: (r: ResolvedSuggestion) => void }) {
  const { rec, label, superseded } = message;
  const [resolved, setResolved] = useState<Record<string, 'ACCEPTED' | 'DISCARDED'>>({});
  if (superseded) {
    return (
      <p className="text-xs text-[var(--color-muted)]" data-recommendation-old>
        {es.ai.recommendations} · {label}
      </p>
    );
  }
  return (
    <section aria-label={`${es.ai.recommendations}: ${label}`} data-recommendation={rec.artifact.id} className="mr-2 rounded-lg rounded-tl-none border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-text)]">
      <p className="text-xs font-semibold text-[var(--color-ai)]">
        <span aria-hidden="true">✦ </span>
        {es.gate.aiRecommendation} · {label}
      </p>
      <p className="text-xs text-[var(--color-muted)]">{rec.kind === 'AI_ONLY' ? es.panel.recAdvisory : es.panel.recRules}</p>
      {rec.summary ? <p className="mt-1">{rec.summary}</p> : null}
      {rec.fields.length === 0 ? <p className="mt-1 text-xs">{es.panel.recNoFields}</p> : null}

      <ul className="mt-2 space-y-1">
        {rec.fields.map((f) => {
          const style = statusStyle[f.status];
          const done = f.suggestion ? resolved[f.suggestion.id] : undefined;
          return (
            <li key={f.field} data-field={f.field} data-status={f.status} className="rounded-md bg-[var(--color-surface)] p-2">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {f.label}
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${style.classes}`}>
                  <span aria-hidden="true">{style.icon}</span>
                  {es.panel.statusLabels[f.status]}
                </span>
              </p>
              {f.status === 'CHANGE' && f.suggestion ? (
                done ? (
                  <p className="mt-1 text-xs font-medium text-[var(--color-success)]">
                    <span aria-hidden="true">{done === 'ACCEPTED' ? '✓ ' : '– '}</span>
                    {done === 'ACCEPTED' ? es.panel.resolvedAccepted : es.panel.resolvedDiscarded}
                  </p>
                ) : (
                  <>
                    <ul className="mt-1">
                      <SuggestionCard
                        embedded
                        projectId={projectId}
                        suggestion={f.suggestion}
                        onResolved={(r) => {
                          setResolved((prev) => ({ ...prev, [r.suggestion.id]: r.suggestion.status === 'ACCEPTED' ? 'ACCEPTED' : 'DISCARDED' }));
                          onResolved(r);
                        }}
                      />
                    </ul>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{basisText(f)}</p>
                  </>
                )
              ) : f.rationale && f.status !== 'NO_RESPONSE' ? (
                <p className="mt-1 text-xs text-[var(--color-muted)]">{f.rationale}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rec.questions.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none font-medium">
            {es.panel.recQuestions} ({rec.questions.length})
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {rec.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <ReplyDetails used={rec.contextUsed} disclaimer={rec.disclaimer} model={rec.model} />
    </section>
  );
}
