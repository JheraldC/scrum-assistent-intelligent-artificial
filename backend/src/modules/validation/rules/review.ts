import type { RuleOutput, RuleSet } from './types.js';

/** Instantánea de la Sprint Review que se evalúa (GATE-REVIEW). */
export interface ReviewSnapshot {
  results: string;
  increment: string;
  feedback: string;
  goalAssessment: 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED' | null;
  goalAssessmentNote: string;
}

const filled = (text: string) => text.trim() !== '';

function required(text: string, met: string, notMet: RuleOutput): RuleOutput {
  return filled(text) ? { outcome: 'MET', evidence: met } : notMet;
}

export const REVIEW_RULES: RuleSet<ReviewSnapshot> = {
  'REV-01': (s) =>
    required(s.results, 'Hay resultados registrados', {
      outcome: 'NOT_MET',
      evidence: 'Sin resultados',
      explanation: 'La Review no registra qué se logró en el Sprint.',
      recommendation: 'Anote los resultados del Sprint: qué historias se completaron y cuáles quedaron pendientes.',
    }),

  'REV-02': (s) =>
    required(s.increment, 'El incremento está descrito', {
      outcome: 'NOT_MET',
      evidence: 'Sin descripción del incremento',
      explanation: 'La Review no describe el incremento que se presentó.',
      recommendation: 'Describa el incremento: qué funciona ahora que antes no existía y cómo se puede comprobar.',
    }),

  'REV-03': (s) => {
    if (!s.goalAssessment) {
      return {
        outcome: 'NOT_MET',
        evidence: 'Sin valoración del Sprint Goal',
        explanation: 'La Review no indica si se alcanzó el Sprint Goal.',
        recommendation: 'Indique si el objetivo del Sprint (Sprint Goal) se alcanzó, se alcanzó en parte o no se alcanzó.',
      };
    }
    return filled(s.goalAssessmentNote)
      ? { outcome: 'MET', evidence: `Valoración: ${s.goalAssessment}` }
      : {
          outcome: 'NOT_MET',
          evidence: 'Valoración sin explicación',
          explanation: 'La valoración del Sprint Goal no explica en qué se basa.',
          recommendation: 'Añada una frase que explique por qué el objetivo se alcanzó, se alcanzó en parte o no se alcanzó.',
        };
  },

  'REV-04': (s) =>
    required(s.feedback, 'Hay retroalimentación registrada', {
      outcome: 'NOT_MET',
      evidence: 'Sin retroalimentación',
      explanation: 'La Review no registra la retroalimentación recibida de las personas interesadas.',
      recommendation: 'Anote la retroalimentación recibida y los cambios que sugiere para el Product Backlog.',
    }),
};
