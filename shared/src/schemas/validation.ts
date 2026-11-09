import { z } from 'zod';
import { GATE_IDS, ORIGINS, TARGET_TYPES } from '../enums.js';

export const GateIdSchema = z.enum(GATE_IDS, 'Compuerta desconocida.');
export const TargetTypeSchema = z.enum(TARGET_TYPES, 'Tipo de objetivo desconocido.');

export const EvaluateRequestSchema = z.object({
  gateId: GateIdSchema,
  targetType: TargetTypeSchema,
  targetId: z.uuid('Identificador de objetivo no válido.'),
  // Por defecto no se consulta a la IA: se pide bajo demanda para cuidar el cupo diario.
  requestAiFeedback: z.boolean().default(false),
});
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export const ValidationQuerySchema = z.object({
  targetType: TargetTypeSchema.optional(),
  targetId: z.uuid().optional(),
});

export const OutcomeSchema = z.enum(['MET', 'NOT_MET', 'NOT_APPLICABLE']);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const CriterionResultDtoSchema = z.object({
  criterionId: z.string(),
  origin: z.enum(ORIGINS),
  mandatory: z.boolean(),
  outcome: OutcomeSchema,
  evidence: z.string(),
  explanation: z.string(),
  recommendation: z.string(),
  /** Etiqueta de interfaz «Comprobación por reglas» (FR-022). */
  source: z.literal('RULE_CHECK'),
});
export type CriterionResultDto = z.infer<typeof CriterionResultDtoSchema>;
