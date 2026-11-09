import { jaccard, normalizeText, wordCount } from '../normalize.js';
import { VAGUE_PHRASES, VAGUE_WORDS } from '../dictionaries/vagos.es.js';
import type { RuleOutput, RuleSet } from './types.js';

/** Instantánea del elemento del backlog que se evalúa (GATE-STORY). */
export interface StorySnapshot {
  kind: 'USER_STORY' | 'ITEM';
  title: string;
  asA: string | null;
  iWant: string | null;
  soThat: string | null;
  description: string | null;
  acceptanceCriteria: string[];
  priority: number;
}

const NA: RuleOutput = { outcome: 'NOT_APPLICABLE' };
const blank = (v: string | null | undefined) => !v || v.trim() === '';
const nonBlank = (list: string[]) => list.filter((c) => c.trim() !== '');
const vagueSet = new Set(VAGUE_WORDS);

/** Términos vagos presentes en los textos (tal como los escribió la persona, en minúsculas). */
export function findVagueTerms(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const token of text.split(/\s+/)) {
      const clean = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (clean && vagueSet.has(normalizeText(clean))) found.add(clean.toLowerCase());
    }
    const normalized = ` ${normalizeText(text)} `;
    for (const phrase of VAGUE_PHRASES) if (normalized.includes(` ${phrase} `)) found.add(phrase);
  }
  return [...found];
}

const isStory = (s: StorySnapshot) => s.kind === 'USER_STORY';

export const STORY_RULES: RuleSet<StorySnapshot> = {
  'STORY-01': (s) => {
    const text = isStory(s) ? s.iWant : s.description;
    const ok = !blank(s.title) && !blank(text);
    return ok
      ? { outcome: 'MET', evidence: `Título: «${s.title.trim()}»` }
      : {
          outcome: 'NOT_MET',
          evidence: `Título: ${blank(s.title) ? 'vacío' : 'presente'}; texto: ${blank(text) ? 'vacío' : 'presente'}`,
          explanation: 'El elemento no tiene una descripción completa: falta el título o el texto que explica qué se necesita.',
          recommendation: 'Escriba un título breve y un texto que explique qué se necesita y para quién.',
        };
  },

  'STORY-02': (s) =>
    Number.isInteger(s.priority) && s.priority >= 1
      ? { outcome: 'MET', evidence: `Prioridad ${s.priority}` }
      : {
          outcome: 'NOT_MET',
          evidence: `Prioridad ${String(s.priority)}`,
          explanation: 'El elemento no tiene un orden asignado en el Product Backlog.',
          recommendation: 'Asigne una prioridad (1 es lo más importante) para ordenar el Product Backlog.',
        },

  'STORY-03': (s) => {
    if (!isStory(s)) return NA;
    const missing = [
      blank(s.asA) ? 'rol («Como…»)' : null,
      blank(s.iWant) ? 'necesidad («Quiero…»)' : null,
      blank(s.soThat) ? 'beneficio («Para…»)' : null,
    ].filter((m): m is string => m !== null);
    return missing.length === 0
      ? { outcome: 'MET', evidence: 'Rol, necesidad y beneficio presentes' }
      : {
          outcome: 'NOT_MET',
          evidence: `Falta: ${missing.join(', ')}`,
          explanation: `La historia está incompleta. Falta: ${missing.join(', ')}.`,
          recommendation: 'Complete el formato: «Como [rol] quiero [necesidad] para [beneficio]».',
        };
  },

  'STORY-04': (s) => {
    if (!isStory(s)) return NA;
    const count = nonBlank(s.acceptanceCriteria).length;
    return count >= 1
      ? { outcome: 'MET', evidence: `${count} criterio(s) de aceptación` }
      : {
          outcome: 'NOT_MET',
          evidence: '0 criterios de aceptación',
          explanation: 'La historia no tiene criterios de aceptación, así que no hay forma de saber cuándo está terminada.',
          recommendation:
            'Agregue al menos un criterio de aceptación que se pueda comprobar con sí o no, por ejemplo: «Se muestra un mensaje de error si el correo ya existe».',
        };
  },

  'STORY-05': (s) => {
    const texts = [s.title, s.iWant ?? '', s.description ?? '', ...nonBlank(s.acceptanceCriteria)];
    const terms = findVagueTerms(texts);
    return terms.length === 0
      ? { outcome: 'MET', evidence: 'Sin términos vagos' }
      : {
          outcome: 'NOT_MET',
          evidence: terms.join(', '),
          explanation: `Se detectaron términos vagos que no se pueden verificar: ${terms.join(', ')}.`,
          recommendation:
            'Reemplace cada término por una medida o un comportamiento concreto, por ejemplo «responde en menos de 2 segundos» en lugar de «rápido».',
        };
  },

  'STORY-06': (s) => {
    const criteria = nonBlank(s.acceptanceCriteria);
    if (criteria.length === 0) return NA;
    const short = criteria.map((c, i) => ({ n: i + 1, words: wordCount(c) })).filter((c) => c.words < 5);
    return short.length === 0
      ? { outcome: 'MET', evidence: `${criteria.length} criterio(s) de 5 palabras o más` }
      : {
          outcome: 'NOT_MET',
          evidence: `Criterios demasiado cortos: ${short.map((c) => `n.º ${c.n} (${c.words} palabras)`).join(', ')}`,
          explanation: 'Algunos criterios de aceptación son demasiado breves para describir un resultado comprobable.',
          recommendation: 'Redacte cada criterio con al menos 5 palabras: qué ocurre, cuándo y con qué resultado observable.',
        };
  },

  'STORY-07': (s) => {
    if (!isStory(s)) return NA;
    const n = wordCount(s.iWant ?? '');
    return n >= 4 && n <= 40
      ? { outcome: 'MET', evidence: `${n} palabras` }
      : {
          outcome: 'NOT_MET',
          evidence: `${n} palabras`,
          explanation: `La necesidad tiene ${n} palabras; debería tener entre 4 y 40 para ser clara.`,
          recommendation: n < 4 ? 'Explique mejor qué necesita la persona usuaria.' : 'Resuma la necesidad o divida la historia en varias.',
        };
  },

  'STORY-08': (s) => {
    if (!isStory(s) || blank(s.iWant) || blank(s.soThat)) return NA;
    const similarity = jaccard(s.iWant!, s.soThat!);
    return similarity < 0.8
      ? { outcome: 'MET', evidence: `Similitud ${similarity.toFixed(2)}` }
      : {
          outcome: 'NOT_MET',
          evidence: `Similitud ${similarity.toFixed(2)}`,
          explanation: 'El beneficio repite casi literalmente la necesidad, así que no explica para qué sirve.',
          recommendation: 'Explique el valor que obtiene la persona o el negocio: ¿qué problema se resuelve o qué mejora?',
        };
  },
};
