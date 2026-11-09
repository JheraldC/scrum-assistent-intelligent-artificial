import { z } from 'zod';
import { ExpectedVersionSchema } from './common.js';

export const RETRO_ACTION_STATUSES = ['OPEN', 'DONE', 'DISCARDED'] as const;
export type RetroActionStatus = (typeof RETRO_ACTION_STATUSES)[number];

// data-model.md: positivos/problemas/mejoras con máximo 30 elementos de ≤ 500 caracteres.
const retroList = (label: string) =>
  z
    .array(z.string().trim().max(500, `Cada elemento de «${label}» no puede superar 500 caracteres.`))
    .max(30, `No puede haber más de 30 elementos en «${label}».`);

export const RetrospectiveUpdateSchema = z
  .object({
    positives: retroList('aspectos positivos'),
    problems: retroList('problemas'),
    improvements: retroList('oportunidades de mejora'),
  })
  .extend(ExpectedVersionSchema.shape);
export type RetrospectiveUpdate = z.infer<typeof RetrospectiveUpdateSchema>;

// data-model.md: description 1–300; follow_up_note ≤ 500; owner_id opcional (debe ser miembro, lo valida el servicio).
export const RetroActionInputSchema = z.object({
  description: z
    .string('La descripción de la acción es obligatoria.')
    .trim()
    .min(1, 'La descripción de la acción es obligatoria.')
    .max(300, 'La descripción de la acción no puede superar 300 caracteres.'),
  ownerId: z.uuid('Responsable no válido.').nullable().optional(),
  forNextSprint: z.boolean().optional(),
  status: z.enum(RETRO_ACTION_STATUSES, 'Estado de la acción no válido.').optional(),
  followUpNote: z.string().trim().max(500, 'La nota de seguimiento no puede superar 500 caracteres.').optional(),
});
export type RetroActionInput = z.infer<typeof RetroActionInputSchema>;

export const RetroActionUpdateSchema = RetroActionInputSchema.partial()
  .extend(ExpectedVersionSchema.shape)
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), { message: 'Indique qué desea cambiar.', path: ['description'] });
export type RetroActionUpdate = z.infer<typeof RetroActionUpdateSchema>;
