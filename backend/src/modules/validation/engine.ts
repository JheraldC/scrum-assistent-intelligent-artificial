import type { CriterionResultDto, GateId, Outcome } from '@scrum/shared';
import { getGate } from './catalog/index.js';
import { PLAN_RULES, type PlanSnapshot } from './rules/plan.js';
import { STORY_RULES, type StorySnapshot } from './rules/story.js';
import type { RuleOutput, RuleSet } from './rules/types.js';

export type RunStatus = 'PASSED' | 'FAILED' | 'ERROR';

export type EngineResult = Omit<CriterionResultDto, 'source'>;

export interface EngineRun {
  status: RunStatus;
  results: EngineResult[];
  /** Mensaje técnico si status = ERROR (no se muestra a las personas). */
  error?: string;
}

const OUTCOMES: readonly Outcome[] = ['MET', 'NOT_MET', 'NOT_APPLICABLE'];

function checkOutput(criterionId: string, output: RuleOutput): RuleOutput {
  if (!output || !OUTCOMES.includes(output.outcome)) {
    throw new Error(`La regla ${criterionId} devolvió un resultado inválido`);
  }
  return output;
}

/**
 * Evalúa una compuerta con un conjunto de reglas (motor puro, sin BD, red ni reloj).
 * Una regla que falla o devuelve un resultado inválido produce `ERROR`, que nunca aprueba (FR-023).
 */
export function evaluateWithRules<S>(gateId: GateId, snapshot: S, rules: RuleSet<S>): EngineRun {
  const gate = getGate(gateId);
  if (!gate) return { status: 'ERROR', results: [], error: `Compuerta desconocida: ${gateId}` };

  const results: EngineResult[] = [];
  try {
    for (const criterion of gate.criteria) {
      const rule = rules[criterion.id];
      if (!rule) throw new Error(`No hay regla para el criterio ${criterion.id}`);
      const output = checkOutput(criterion.id, rule(snapshot));
      results.push({
        criterionId: criterion.id,
        origin: criterion.origin,
        mandatory: criterion.mandatory,
        outcome: output.outcome,
        evidence: output.evidence ?? '',
        explanation: output.outcome === 'NOT_MET' ? (output.explanation ?? '') : '',
        recommendation: output.outcome === 'NOT_MET' ? (output.recommendation ?? '') : '',
      });
    }
  } catch (error) {
    return { status: 'ERROR', results, error: error instanceof Error ? error.message : String(error) };
  }

  const failed = results.some((r) => r.mandatory && r.outcome === 'NOT_MET');
  return { status: failed ? 'FAILED' : 'PASSED', results };
}

/** Reglas por compuerta; se amplía con GATE-PLAN, GATE-REVIEW y GATE-RETRO en sus historias. */
export function evaluate(gateId: 'GATE-STORY', snapshot: StorySnapshot): EngineRun;
export function evaluate(gateId: 'GATE-PLAN', snapshot: PlanSnapshot): EngineRun;
export function evaluate(gateId: GateId, snapshot: never): EngineRun;
export function evaluate(gateId: GateId, snapshot: unknown): EngineRun {
  switch (gateId) {
    case 'GATE-STORY':
      return evaluateWithRules(gateId, snapshot as StorySnapshot, STORY_RULES);
    case 'GATE-PLAN':
      return evaluateWithRules(gateId, snapshot as PlanSnapshot, PLAN_RULES);
    default:
      return { status: 'ERROR', results: [], error: `La compuerta ${gateId} aún no está disponible` };
  }
}
