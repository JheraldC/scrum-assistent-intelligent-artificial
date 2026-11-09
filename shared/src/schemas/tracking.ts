import { z } from 'zod';
import { ExpectedVersionSchema } from './common.js';

export const TRACKING_KINDS = ['PROGRESS', 'IMPEDIMENT', 'OBSERVATION', 'DAILY_NOTE'] as const;
export type TrackingKind = (typeof TRACKING_KINDS)[number];

export const GOAL_ASSESSMENTS = ['ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED'] as const;
export type GoalAssessment = (typeof GOAL_ASSESSMENTS)[number];

// data-model.md: contenido de 1 a 2000 caracteres.
export const TrackingEntryInputSchema = z.object({
  kind: z.enum(TRACKING_KINDS, 'Tipo de registro no válido.'),
  content: z
    .string('El contenido es obligatorio.')
    .trim()
    .min(1, 'El contenido es obligatorio.')
    .max(2000, 'El contenido no puede superar 2000 caracteres.'),
});
export type TrackingEntryInput = z.infer<typeof TrackingEntryInputSchema>;

const reviewText = (label: string) => z.string(`${label} es obligatorio.`).trim().max(5000, `${label} no puede superar 5000 caracteres.`);

export const SprintReviewUpdateSchema = z
  .object({
    results: reviewText('El resultado'),
    increment: reviewText('El incremento'),
    feedback: reviewText('La retroalimentación'),
    goalAssessment: z.enum(GOAL_ASSESSMENTS, 'Valoración no válida.').nullable(),
    goalAssessmentNote: z.string().trim().max(2000, 'La explicación no puede superar 2000 caracteres.'),
  })
  .extend(ExpectedVersionSchema.shape);
export type SprintReviewUpdate = z.infer<typeof SprintReviewUpdateSchema>;
