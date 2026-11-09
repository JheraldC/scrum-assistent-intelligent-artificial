import { es } from '../../i18n/es';

type Source = 'RULE_CHECK' | 'AI_RECOMMENDATION';

/** Distingue visualmente las comprobaciones por reglas de las recomendaciones de IA (FR-022). */
export function SourceBadge({ source }: { source: Source }) {
  const isAi = source === 'AI_RECOMMENDATION';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
        isAi ? 'bg-[var(--color-ai-bg)] text-[var(--color-ai)]' : 'bg-[var(--color-info-bg)] text-[var(--color-info)]'
      }`}
    >
      <span aria-hidden="true">{isAi ? '✦' : '☑'}</span>
      {isAi ? es.gate.aiRecommendation : es.gate.ruleCheck}
    </span>
  );
}
