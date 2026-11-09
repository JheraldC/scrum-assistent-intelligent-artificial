import { z } from 'zod';
import { ExpectedVersionSchema } from './common.js';

export const BACKLOG_KINDS = ['USER_STORY', 'ITEM'] as const;
export type BacklogKind = (typeof BACKLOG_KINDS)[number];

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} no puede superar ${max} caracteres.`).optional();

// Límites de data-model.md: title ≤ 120, as_a ≤ 200, i_want/so_that ≤ 500, description ≤ 2 000,
// acceptance_criteria ≤ 20 elementos de ≤ 300 caracteres, priority entero ≥ 1.
export const BacklogItemInputSchema = z.object({
  kind: z.enum(BACKLOG_KINDS, 'El tipo debe ser historia de usuario o elemento.'),
  title: z
    .string('El título es obligatorio.')
    .trim()
    .min(1, 'El título es obligatorio.')
    .max(120, 'El título no puede superar 120 caracteres.'),
  asA: optionalText(200, 'El rol'),
  iWant: optionalText(500, 'La necesidad'),
  soThat: optionalText(500, 'El beneficio'),
  description: optionalText(2000, 'La descripción'),
  acceptanceCriteria: z
    .array(z.string().trim().max(300, 'Cada criterio de aceptación no puede superar 300 caracteres.'))
    .max(20, 'No puede haber más de 20 criterios de aceptación.')
    .default([]),
  priority: z
    .number('La prioridad es obligatoria.')
    .int('La prioridad debe ser un número entero.')
    .min(1, 'La prioridad debe ser 1 o mayor.'),
});
export type BacklogItemInput = z.infer<typeof BacklogItemInputSchema>;

export const BacklogItemUpdateSchema = BacklogItemInputSchema.extend(ExpectedVersionSchema.shape);
export type BacklogItemUpdate = z.infer<typeof BacklogItemUpdateSchema>;
