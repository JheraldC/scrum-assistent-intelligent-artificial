import { z } from 'zod';
import { TargetTypeSchema } from './validation.js';

// Mensaje de la persona al asistente: 1–2 000 caracteres (plan.md, "Costos y límites").
export const ChatRequestSchema = z.object({
  message: z
    .string('Escriba su pregunta.')
    .trim()
    .min(1, 'Escriba su pregunta.')
    .max(2000, 'La pregunta no puede superar 2 000 caracteres.'),
  /** Artefacto que la persona tiene en pantalla; acota el contexto que se envía al modelo. */
  focus: z.object({ targetType: TargetTypeSchema, targetId: z.uuid() }).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Recomendación de IA: siempre etiquetada y nunca decide el estado de una compuerta (FR-022, FR-023). */
export const AiObservationSchema = z.object({
  criterionId: z.string().nullable(),
  text: z.string(),
  suggestedRewrite: z.string().nullable(),
  source: z.literal('AI_RECOMMENDATION'),
});
export type AiObservation = z.infer<typeof AiObservationSchema>;

export const AgentReplySchema = z.object({
  interactionId: z.uuid(),
  answer: z.string(),
  suggestions: z.array(z.object({ target: z.string(), text: z.string() })),
  referencedCriteria: z.array(z.string()),
  disclaimer: z.string(),
  source: z.literal('AI_RECOMMENDATION'),
  model: z.string(),
});
export type AgentReply = z.infer<typeof AgentReplySchema>;
