import { z } from 'zod';
import { ExpectedVersionSchema } from './common.js';

// Límites de data-model.md: sprint_goal ≤ 500, work_plan ≤ 5 000.
export const SprintUpdateSchema = z
  .object({
    sprintGoal: z.string().trim().max(500, 'El Sprint Goal no puede superar 500 caracteres.').optional(),
    workPlan: z.string().trim().max(5000, 'El plan de trabajo no puede superar 5 000 caracteres.').optional(),
  })
  .extend(ExpectedVersionSchema.shape)
  .refine((v) => v.sprintGoal !== undefined || v.workPlan !== undefined, {
    message: 'Indique el Sprint Goal o el plan de trabajo.',
    path: ['sprintGoal'],
  });
export type SprintUpdate = z.infer<typeof SprintUpdateSchema>;

export const SprintItemsSchema = z.object({
  itemIds: z.array(z.uuid('Identificador de elemento no válido.')).max(200, 'Demasiados elementos seleccionados.'),
  ...ExpectedVersionSchema.shape,
});
export type SprintItemsInput = z.infer<typeof SprintItemsSchema>;
