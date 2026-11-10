import type { ValidationRun } from '../../api/types';
import { es } from '../../i18n/es';
import { Button } from '../ui/Button';
import { RunStatusBadge } from '../validation/GateResultPanel';
import { useAssistant, type ArtifactRef } from './AssistantContext';

/**
 * «Pedir recomendación de IA»: envía sola la solicitud contextual al asistente (sin copiar ni pegar un
 * prompt) y la respuesta, campo por campo, aparece en la conversación del panel derecho.
 */
export function RecommendButton({ artifact, disabled, className }: { artifact: ArtifactRef; disabled?: boolean; className?: string }) {
  const { recommend, busy } = useAssistant();
  return (
    <Button variant="secondary" className={className} disabled={disabled || busy} aria-describedby={undefined} onClick={() => void recommend(artifact)}>
      {es.panel.askRecommendation}
    </Button>
  );
}

/**
 * Indicador compacto de la última evaluación por reglas: el detalle (criterios, evidencia, explicación y
 * cómo corregir) se muestra en el panel del asistente para no duplicar resultados bajo el formulario.
 */
export function EvaluationSummary({ run, label, artifact }: { run: ValidationRun; label: string; artifact?: ArtifactRef | null }) {
  const { reportEvaluation } = useAssistant();
  const met = run.results.filter((r) => r.outcome === 'MET').length;
  const notMet = run.results.filter((r) => r.outcome === 'NOT_MET').length;
  return (
    <p className="my-3 flex flex-wrap items-center gap-2 text-sm" data-evaluation-summary>
      <span className="font-medium">{es.panel.lastEvaluation}:</span>
      <RunStatusBadge status={run.status} />
      <span className="text-[var(--color-muted)]">
        {es.gate.attempt} {run.attemptNo} · {es.gate.summary(met, notMet)}
      </span>
      <Button variant="secondary" onClick={() => reportEvaluation(run, label, artifact ?? null)}>
        {es.panel.seeInAssistant}
      </Button>
    </p>
  );
}
