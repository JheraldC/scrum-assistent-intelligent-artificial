import { z } from 'zod';

// Formas esperadas de la salida del modelo (contracts/ai-response.schema.json). Cualquier salida
// que no las cumpla se considera inválida y nunca produce una aprobación (FR-023, FR-024).

const CRITERION_ID = /^(STORY|PLAN|REV|RETRO)-[0-9]{2}$/;

export const ChatReplySchema = z
  .object({
    type: z.literal('chat_reply'),
    answer: z.string().min(1).max(3000),
    suggestions: z
      .array(z.object({ target: z.string().max(100), text: z.string().min(1).max(800) }).strict())
      .max(5)
      .optional(),
    referencedCriteria: z.array(z.string().regex(CRITERION_ID)).max(20).optional(),
  })
  .strict();
export type ChatReply = z.infer<typeof ChatReplySchema>;

export const ValidationFeedbackSchema = z
  .object({
    type: z.literal('validation_feedback'),
    summary: z.string().max(1000).optional(),
    observations: z
      .array(
        z
          .object({
            criterionId: z.string().regex(CRITERION_ID).nullable().optional(),
            text: z.string().min(1).max(800),
            suggestedRewrite: z.string().max(800).nullable().optional(),
          })
          .strict(),
      )
      .max(15),
  })
  .strict();
export type ValidationFeedback = z.infer<typeof ValidationFeedbackSchema>;

export type OutputKind = 'chat_reply' | 'validation_feedback';
type Parsed<K extends OutputKind> = K extends 'chat_reply' ? ChatReply : ValidationFeedback;

export type ParseResult<K extends OutputKind> = { ok: true; value: Parsed<K> } | { ok: false; reason: string };

/** Extrae el primer objeto JSON del texto (admite bloques de código y texto alrededor). */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (text === '') throw new Error('respuesta vacía');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no contiene un objeto JSON');
  return JSON.parse(text.slice(start, end + 1));
}

/** Valida la salida del modelo contra el esquema del tipo esperado. El motivo es corto y sin contenido. */
export function parseAgentOutput<K extends OutputKind>(kind: K, raw: string): ParseResult<K> {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch (error) {
    return { ok: false, reason: `JSON inválido: ${error instanceof Error ? error.message.slice(0, 120) : 'error'}` };
  }
  const schema = kind === 'chat_reply' ? ChatReplySchema : ValidationFeedbackSchema;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, reason: `Esquema inválido en «${first?.path.join('.') || 'raíz'}»: ${first?.message.slice(0, 120) ?? ''}` };
  }
  return { ok: true, value: parsed.data as Parsed<K> };
}
