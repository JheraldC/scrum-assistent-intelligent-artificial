import { z } from 'zod';

export const PROBLEM_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'GATE_NOT_PASSED',
  'STAGE_ORDER',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_INVALID_RESPONSE',
  'AI_TIMEOUT',
  'AI_BUDGET_EXCEEDED',
  'LAST_FACILITATOR',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

/** Formato de error de la API (contracts/openapi.yaml, componente Problem). Mensajes en español. */
export const ProblemSchema = z.object({
  code: z.enum(PROBLEM_CODES),
  message: z.string(),
  details: z.array(z.object({ field: z.string().optional(), message: z.string() })).optional(),
  requestId: z.string(),
});
export type Problem = z.infer<typeof ProblemSchema>;
