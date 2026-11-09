import { wordCount } from '../normalize.js';
import { findVagueTerms } from './story.js';
import type { RuleOutput, RuleSet } from './types.js';

export interface RetroActionSnapshot {
  description: string;
  ownerId: string | null;
  forNextSprint: boolean;
}

/** Instantánea de la retrospectiva que se evalúa (GATE-RETRO). */
export interface RetroSnapshot {
  positives: string[];
  problems: string[];
  improvements: string[];
  actions: RetroActionSnapshot[];
  /** Acciones del Sprint anterior con la fecha de su último seguimiento (ISO) o null si nunca. */
  previousActions: { followUpUpdatedAt: string | null }[];
  /** Inicio del Sprint actual (ISO): el seguimiento debe ser posterior a este instante. */
  sprintStartedAt: string;
}

const NA: RuleOutput = { outcome: 'NOT_APPLICABLE' };
const nonBlank = (list: string[]) => list.filter((t) => t.trim() !== '');
const realActions = (s: RetroSnapshot) => s.actions.filter((a) => a.description.trim() !== '');

export const RETRO_RULES: RuleSet<RetroSnapshot> = {
  'RETRO-01': (s) => {
    const n = realActions(s).length;
    return n >= 1
      ? { outcome: 'MET', evidence: `${n} acción(es) de mejora` }
      : {
          outcome: 'NOT_MET',
          evidence: '0 acciones de mejora',
          explanation: 'La retrospectiva no define ninguna acción de mejora, así que el equipo no se lleva ningún cambio concreto.',
          recommendation: 'Defina al menos una acción concreta para el siguiente Sprint, por ejemplo «Limitar la reunión diaria a 15 minutos con temporizador».',
        };
  },

  'RETRO-02': (s) => {
    const positives = nonBlank(s.positives).length;
    const problems = nonBlank(s.problems).length;
    return positives >= 1 && problems >= 1
      ? { outcome: 'MET', evidence: `${positives} positivo(s) y ${problems} problema(s)` }
      : {
          outcome: 'NOT_MET',
          evidence: `${positives} positivo(s) y ${problems} problema(s)`,
          explanation: 'Falta registrar al menos un aspecto positivo y un problema del Sprint.',
          recommendation: 'Anote qué salió bien y qué salió mal; sin ambos es difícil acordar mejoras con sentido.',
        };
  },

  'RETRO-03': (s) => {
    const actions = realActions(s);
    if (actions.length === 0) return NA;
    const problems: string[] = [];
    actions.forEach((a, i) => {
      const words = wordCount(a.description);
      const vague = findVagueTerms([a.description]);
      if (words < 5) problems.push(`n.º ${i + 1} tiene ${words} palabras`);
      if (vague.length > 0) problems.push(`n.º ${i + 1} usa términos vagos (${vague.join(', ')})`);
    });
    return problems.length === 0
      ? { outcome: 'MET', evidence: `${actions.length} acción(es) claras` }
      : {
          outcome: 'NOT_MET',
          evidence: problems.join('; '),
          explanation: 'Algunas acciones no son lo bastante claras: son demasiado breves o usan términos vagos.',
          recommendation: 'Redacte cada acción con al menos 5 palabras y di qué se hará, cómo se comprobará y cuándo, sin términos como «mejorar» o «adecuado».',
        };
  },

  'RETRO-04': (s) => {
    const actions = realActions(s);
    if (actions.length === 0) return NA;
    const sinResponsable = actions.map((a, i) => ({ a, n: i + 1 })).filter(({ a }) => !a.ownerId);
    return sinResponsable.length === 0
      ? { outcome: 'MET', evidence: 'Todas las acciones tienen responsable' }
      : {
          outcome: 'NOT_MET',
          evidence: `Sin responsable: acción n.º ${sinResponsable.map((x) => x.n).join(', ')}`,
          explanation: 'Hay acciones sin responsable; sin una persona a cargo es probable que nadie las haga.',
          recommendation: 'Asigne a cada acción un responsable miembro del proyecto.',
        };
  },

  'RETRO-05': (s) => {
    if (s.previousActions.length === 0) return NA;
    const start = new Date(s.sprintStartedAt).getTime();
    const pending = s.previousActions.filter((a) => !a.followUpUpdatedAt || new Date(a.followUpUpdatedAt).getTime() <= start);
    return pending.length === 0
      ? { outcome: 'MET', evidence: `${s.previousActions.length} acción(es) del Sprint anterior con seguimiento` }
      : {
          outcome: 'NOT_MET',
          evidence: `${pending.length} de ${s.previousActions.length} acción(es) del Sprint anterior sin seguimiento actualizado`,
          explanation: 'Las acciones acordadas en el Sprint anterior no tienen su estado de seguimiento actualizado en este Sprint.',
          recommendation: 'Revise cada acción del Sprint anterior y actualice su estado (hecha, descartada o abierta) con una nota.',
        };
  },

  'RETRO-06': (s) => {
    const actions = realActions(s);
    if (actions.length === 0) return NA;
    return actions.some((a) => a.forNextSprint)
      ? { outcome: 'MET', evidence: `${actions.filter((a) => a.forNextSprint).length} acción(es) para el siguiente Sprint` }
      : {
          outcome: 'NOT_MET',
          evidence: 'Ninguna acción marcada para el siguiente Sprint',
          explanation: 'Ninguna acción está marcada para incorporarse al trabajo del siguiente Sprint.',
          recommendation: 'Marque al menos una acción para llevarla al siguiente Sprint y que se haga de verdad.',
        };
  },
};
