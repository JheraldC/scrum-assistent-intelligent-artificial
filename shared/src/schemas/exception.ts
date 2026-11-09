import { z } from 'zod';

// data-model.md: justificación obligatoria, al menos 10 caracteres sin espacios sobrantes (≤ 1 000).
export const GateExceptionInputSchema = z.object({
  justification: z
    .string('La justificación es obligatoria.')
    .trim()
    .min(10, 'La justificación debe tener al menos 10 caracteres.')
    .max(1000, 'La justificación no puede superar 1 000 caracteres.'),
});
export type GateExceptionInput = z.infer<typeof GateExceptionInputSchema>;
