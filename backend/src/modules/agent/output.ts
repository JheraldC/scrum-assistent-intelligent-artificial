// Salida del modelo (contracts/ai-response.schema.json). El modelo real no siempre respeta el formato al
// pie de la letra (claves de más, textos largos, JSON cortado, texto fuera del JSON). En lugar de descartar
// toda la respuesta, se SANEA: solo se conservan las claves conocidas, con tipos y longitudes válidos; lo
// demás se ignora. Nada de lo que llega aquí decide una compuerta ni modifica datos (FR-023, FR-024).

const CRITERION_ID = /^(STORY|PLAN|REV|RETRO)-[0-9]{2}$/;
const PROPOSAL_KINDS = ['STORY', 'ACCEPTANCE_CRITERIA', 'TASK', 'RISK', 'DEPENDENCY', 'QUESTION'] as const;
const FIELD_STATUSES = ['CHANGE', 'NO_CHANGE', 'UNSURE'] as const;

export interface SourceCitation {
  document: string;
  section?: string;
}

/** Propuesta revisable: nunca se aplica sola; la persona la acepta, edita o descarta. */
export interface Proposal {
  kind: (typeof PROPOSAL_KINDS)[number];
  title?: string;
  text: string;
  asA?: string;
  iWant?: string;
  soThat?: string;
  acceptanceCriteria?: string[];
  /** Código del elemento del Product Backlog al que se refiere (por ejemplo HU-2). */
  itemCode?: string;
  basis?: 'DOCUMENTO' | 'INFERENCIA';
  sources?: SourceCitation[];
}

export interface ChatReply {
  type: 'chat_reply';
  answer: string;
  suggestions?: { target: string; text: string }[];
  referencedCriteria?: string[];
  proposals?: Proposal[];
  basis?: 'DOCUMENTO' | 'INFERENCIA';
  sources?: SourceCitation[];
}

export interface ValidationFeedback {
  type: 'validation_feedback';
  summary?: string;
  observations: { criterionId?: string | null; text: string; suggestedRewrite?: string | null }[];
}

export interface FieldRecommendations {
  type: 'field_recommendations';
  summary?: string;
  fields: {
    field: string;
    status: (typeof FIELD_STATUSES)[number];
    proposed?: string | string[];
    rationale?: string;
    criterionIds?: string[];
    sources?: SourceCitation[];
  }[];
  questions?: string[];
}

export type OutputKind = 'chat_reply' | 'validation_feedback' | 'field_recommendations';
type Parsed<K extends OutputKind> = K extends 'chat_reply' ? ChatReply : K extends 'field_recommendations' ? FieldRecommendations : ValidationFeedback;
export type ParseResult<K extends OutputKind> = { ok: true; value: Parsed<K> } | { ok: false; reason: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Texto no vacío recortado, o undefined. Acepta números (los convierte) pero no objetos. */
function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text.slice(0, max);
}

function strList(value: unknown, maxItems: number, maxLen: number): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return list.flatMap((v) => str(v, maxLen) ?? []).slice(0, maxItems);
}

function sources(value: unknown, max: number): SourceCitation[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((s) => {
      if (!isObj(s)) return [];
      const document = str(s.document ?? s.documento, 120);
      if (!document) return [];
      const section = str(s.section ?? s.seccion, 120);
      return [{ document, ...(section ? { section } : {}) }];
    })
    .slice(0, max);
}

const basis = (value: unknown): 'DOCUMENTO' | 'INFERENCIA' | undefined => (value === 'DOCUMENTO' || value === 'INFERENCIA' ? value : undefined);
const criteria = (value: unknown, max: number) => strList(value, 50, 20).filter((id) => CRITERION_ID.test(id)).slice(0, max);

function proposals(value: unknown): Proposal[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((p): Proposal[] => {
      if (!isObj(p)) return [];
      const kind = String(p.kind ?? '').toUpperCase() as Proposal['kind'];
      if (!PROPOSAL_KINDS.includes(kind)) return [];
      const title = str(p.title, 200);
      const text = str(p.text, 800) ?? str(p.rationale, 800) ?? title;
      if (!text) return [];
      const acceptanceCriteria = strList(p.acceptanceCriteria, 10, 300);
      const cited = sources(p.sources, 3);
      // Solo las claves conocidas: cualquier otra (p. ej. «asignar a alguien» o «aprobar») se ignora.
      return [
        {
          kind,
          text,
          ...(title ? { title } : {}),
          ...(str(p.asA, 200) ? { asA: str(p.asA, 200) } : {}),
          ...(str(p.iWant, 500) ? { iWant: str(p.iWant, 500) } : {}),
          ...(str(p.soThat, 500) ? { soThat: str(p.soThat, 500) } : {}),
          ...(acceptanceCriteria.length > 0 ? { acceptanceCriteria } : {}),
          ...(str(p.itemCode, 20) ? { itemCode: str(p.itemCode, 20) } : {}),
          ...(basis(p.basis) ? { basis: basis(p.basis) } : {}),
          ...(cited.length > 0 ? { sources: cited } : {}),
        },
      ];
    })
    .slice(0, 5);
}

function chatReply(obj: Obj): ChatReply | string {
  const answer = str(obj.answer ?? obj.respuesta ?? obj.message, 3000);
  if (!answer) return 'falta «answer»';
  const suggestions = (Array.isArray(obj.suggestions) ? obj.suggestions : [])
    .flatMap((s) => {
      if (typeof s === 'string') return str(s, 800) ? [{ target: '', text: str(s, 800)! }] : [];
      if (!isObj(s)) return [];
      const text = str(s.text, 800);
      return text ? [{ target: str(s.target, 100) ?? '', text }] : [];
    })
    .slice(0, 5);
  const cited = sources(obj.sources, 6);
  const props = proposals(obj.proposals);
  const referenced = criteria(obj.referencedCriteria, 20);
  return {
    type: 'chat_reply',
    answer,
    ...(suggestions.length > 0 ? { suggestions } : {}),
    ...(referenced.length > 0 ? { referencedCriteria: referenced } : {}),
    ...(props.length > 0 ? { proposals: props } : {}),
    ...(basis(obj.basis) ? { basis: basis(obj.basis) } : {}),
    ...(cited.length > 0 ? { sources: cited } : {}),
  };
}

function validationFeedback(obj: Obj): ValidationFeedback | string {
  if (!Array.isArray(obj.observations)) return 'falta «observations»';
  const observations = obj.observations
    .flatMap((o) => {
      if (!isObj(o)) return [];
      const text = str(o.text, 800);
      if (!text) return [];
      const id = str(o.criterionId, 20);
      return [{ criterionId: id && CRITERION_ID.test(id) ? id : null, text, suggestedRewrite: str(o.suggestedRewrite, 800) ?? null }];
    })
    .slice(0, 15);
  const summary = str(obj.summary, 1000);
  return { type: 'validation_feedback', ...(summary ? { summary } : {}), observations };
}

function fieldRecommendations(obj: Obj): FieldRecommendations | string {
  if (!Array.isArray(obj.fields)) return 'falta «fields»';
  const fields = obj.fields
    .flatMap((f): FieldRecommendations['fields'] => {
      if (!isObj(f)) return [];
      const field = str(f.field, 60);
      const status = String(f.status ?? '').toUpperCase() as (typeof FIELD_STATUSES)[number];
      // Un estado desconocido (p. ej. «aprobar») invalida esa entrada: el campo quedará «sin pronunciamiento».
      if (!field || !FIELD_STATUSES.includes(status)) return [];
      const proposed = Array.isArray(f.proposed) ? strList(f.proposed, 30, 500) : str(f.proposed, 5000);
      const ids = criteria(f.criterionIds, 10);
      const cited = sources(f.sources, 3);
      return [
        {
          field,
          status,
          ...(proposed !== undefined ? { proposed } : {}),
          ...(str(f.rationale, 800) ? { rationale: str(f.rationale, 800) } : {}),
          ...(ids.length > 0 ? { criterionIds: ids } : {}),
          ...(cited.length > 0 ? { sources: cited } : {}),
        },
      ];
    })
    .slice(0, 12);
  const summary = str(obj.summary, 600);
  const questions = strList(obj.questions, 6, 300);
  return { type: 'field_recommendations', ...(summary ? { summary } : {}), fields, ...(questions.length > 0 ? { questions } : {}) };
}

/** Extrae el primer objeto JSON del texto (admite bloques de código y texto alrededor). */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no contiene un objeto JSON');
  return JSON.parse(text.slice(start, end + 1));
}

/** Rescata el texto de «answer» de un JSON cortado (p. ej. cuando el modelo agota sus tokens de salida). */
function salvageAnswer(raw: string): string | undefined {
  const match = /"(?:answer|respuesta)"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw);
  if (!match?.[1]) return undefined;
  let text = match[1];
  try {
    text = JSON.parse(`"${text.replace(/\\$/, '')}"`) as string;
  } catch {
    text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return str(text, 3000);
}

/**
 * Interpreta y sanea la salida del modelo para el tipo esperado. Solo falla si no hay nada utilizable; el
 * motivo es corto y sin contenido del modelo.
 */
export function parseAgentOutput<K extends OutputKind>(kind: K, raw: string): ParseResult<K> {
  const done = (value: ChatReply | ValidationFeedback | FieldRecommendations | string): ParseResult<K> =>
    typeof value === 'string' ? { ok: false, reason: `Formato inválido: ${value}` } : { ok: true, value: value as Parsed<K> };

  const text = (raw ?? '').trim();
  if (text === '') return { ok: false, reason: 'JSON inválido: respuesta vacía' };

  let json: unknown;
  try {
    json = extractJson(text);
  } catch (error) {
    if (kind === 'chat_reply') {
      // JSON cortado: se rescata la respuesta. Texto sin JSON: se usa tal cual como respuesta (texto plano).
      const rescued = text.includes('{') ? salvageAnswer(text) : text.startsWith('[') ? undefined : str(text.replace(/^```\w*|```$/g, ''), 3000);
      if (rescued) return done({ type: 'chat_reply', answer: rescued });
    }
    return { ok: false, reason: `JSON inválido: ${error instanceof Error ? error.message.slice(0, 120) : 'error'}` };
  }
  if (!isObj(json)) return { ok: false, reason: 'JSON inválido: no es un objeto' };
  // Si el modelo declara otro tipo de respuesta conocido, no se reinterpreta.
  if (typeof json.type === 'string' && json.type !== kind && ['chat_reply', 'validation_feedback', 'field_recommendations'].includes(json.type)) {
    return { ok: false, reason: `Formato inválido: se esperaba «${kind}»` };
  }
  if (kind === 'chat_reply') return done(chatReply(json));
  if (kind === 'field_recommendations') return done(fieldRecommendations(json));
  return done(validationFeedback(json));
}
