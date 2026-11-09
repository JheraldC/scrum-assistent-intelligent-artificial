import type { GateState } from '@scrum/shared';
import { STOP_WORDS } from '../dictionaries/vacias.es.js';
import { normalizeText, words, wordCount } from '../normalize.js';
import { findVagueTerms } from './story.js';
import type { RuleOutput, RuleSet } from './types.js';

/** Elemento seleccionado para el Sprint, con el estado derivado de su evaluación de historia. */
export interface PlanItem {
  code: string;
  title: string;
  kind: 'USER_STORY' | 'ITEM';
  storyState: GateState;
}

/** Instantánea del Sprint que se evalúa (GATE-PLAN). */
export interface PlanSnapshot {
  sprintGoal: string;
  workPlan: string;
  items: PlanItem[];
}

const NA: RuleOutput = { outcome: 'NOT_APPLICABLE' };
const blank = (v: string) => v.trim() === '';

/** Raíz simple para comparar singular y plural (equipo/equipos, asistencia/asistencias). */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Términos significativos: sin palabras vacías y de 3 o más letras, en forma de raíz. */
function significantTerms(text: string): Set<string> {
  return new Set(words(text).filter((w) => w.length >= 3 && !STOP_WORDS.has(w)).map(stem));
}

export const PLAN_RULES: RuleSet<PlanSnapshot> = {
  'PLAN-01': (s) =>
    blank(s.sprintGoal)
      ? {
          outcome: 'NOT_MET',
          evidence: 'Sprint Goal vacío',
          explanation: 'El Sprint no tiene Sprint Goal: el equipo no ha dicho para qué es valioso este Sprint.',
          recommendation: 'Escriba en una frase el objetivo que el equipo quiere lograr con este Sprint.',
        }
      : { outcome: 'MET', evidence: `Sprint Goal: «${s.sprintGoal.trim()}»` },

  'PLAN-02': (s) =>
    s.items.length === 0
      ? {
          outcome: 'NOT_MET',
          evidence: '0 elementos seleccionados',
          explanation: 'No hay elementos del Product Backlog seleccionados para el Sprint.',
          recommendation: 'Seleccione del Product Backlog el trabajo que el equipo cree poder terminar en este Sprint.',
        }
      : { outcome: 'MET', evidence: `${s.items.length} elemento(s): ${s.items.map((i) => i.code).join(', ')}` },

  'PLAN-03': (s) =>
    blank(s.workPlan)
      ? {
          outcome: 'NOT_MET',
          evidence: 'Plan de trabajo vacío',
          explanation: 'No hay un plan de trabajo que explique cómo se lograrán el objetivo y el trabajo seleccionado.',
          recommendation: 'Describa los pasos o tareas con los que el equipo entregará los elementos seleccionados.',
        }
      : { outcome: 'MET', evidence: `${wordCount(s.workPlan)} palabras en el plan` },

  'PLAN-04': (s) => {
    if (blank(s.sprintGoal)) return NA; // lo cubre PLAN-01
    const n = wordCount(s.sprintGoal);
    const vague = findVagueTerms([s.sprintGoal]);
    const problems: string[] = [];
    if (n < 5 || n > 40) problems.push(`tiene ${n} palabras (debe tener entre 5 y 40)`);
    if (vague.length > 0) problems.push(`usa términos vagos: ${vague.join(', ')}`);
    return problems.length === 0
      ? { outcome: 'MET', evidence: `${n} palabras, sin términos vagos` }
      : {
          outcome: 'NOT_MET',
          evidence: [`${n} palabras`, vague.length > 0 ? `vagos: ${vague.join(', ')}` : null].filter(Boolean).join('; '),
          explanation: `El Sprint Goal no es lo bastante comprensible: ${problems.join(' y ')}.`,
          recommendation:
            'Redacte un objetivo de 5 a 40 palabras que diga qué valor se entregará y para quién, sin términos como «rápido» o «mejor».',
        };
  },

  'PLAN-05': (s) => {
    if (blank(s.sprintGoal) || s.items.length === 0) return NA;
    const goal = significantTerms(s.sprintGoal);
    const shared = new Set<string>();
    for (const item of s.items) for (const term of significantTerms(item.title)) if (goal.has(term)) shared.add(term);
    return shared.size > 0
      ? { outcome: 'MET', evidence: `Términos en común: ${[...shared].join(', ')}` }
      : {
          outcome: 'NOT_MET',
          evidence: 'Sin términos en común entre el objetivo y los títulos de los elementos',
          explanation: 'El Sprint Goal no parece tener relación con el trabajo seleccionado: no comparten ningún término significativo.',
          recommendation: 'Revise que el objetivo describa el valor del trabajo elegido, o cambie los elementos seleccionados.',
        };
  },

  'PLAN-06': (s) => {
    if (blank(s.workPlan) || s.items.length === 0) return NA;
    const plan = ` ${normalizeText(s.workPlan)} `;
    const missing = s.items.filter((item) => {
      const byCode = plan.includes(` ${normalizeText(item.code)} `);
      const title = normalizeText(item.title);
      return !byCode && !(title !== '' && plan.includes(` ${title} `));
    });
    return missing.length === 0
      ? { outcome: 'MET', evidence: 'El plan menciona todos los elementos seleccionados' }
      : {
          outcome: 'NOT_MET',
          evidence: `El plan no menciona: ${missing.map((i) => i.code).join(', ')}`,
          explanation: 'Algunos elementos seleccionados no aparecen en el plan de trabajo.',
          recommendation: 'Incluya en el plan cada elemento seleccionado (por su código, como HU-1, o por su título) o quítelo de la selección.',
        };
  },

  'PLAN-07': (s) => {
    const stories = s.items.filter((i) => i.kind === 'USER_STORY');
    if (stories.length === 0) return NA;
    const pending = stories.filter((i) => i.storyState !== 'APROBADA');
    return pending.length === 0
      ? { outcome: 'MET', evidence: 'Todas las historias tienen una evaluación aprobada vigente' }
      : {
          outcome: 'NOT_MET',
          evidence: pending.map((i) => `${i.code} (${i.storyState})`).join(', '),
          explanation: 'Hay historias seleccionadas sin una evaluación aprobada vigente.',
          recommendation: 'Evalúe en el Product Backlog las historias indicadas y corríjalas hasta que se aprueben.',
        };
  },
};
