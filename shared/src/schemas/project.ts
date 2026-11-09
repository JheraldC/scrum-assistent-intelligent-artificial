import { z } from 'zod';
import { EmailSchema } from './auth.js';
import { ExpectedVersionSchema } from './common.js';
import { ROLES, STAGE_TYPES, STAGE_STATUSES } from '../enums.js';

export const RoleSchema = z.enum(ROLES);
export const StageTypeSchema = z.enum(STAGE_TYPES);
export const StageStatusSchema = z.enum(STAGE_STATUSES);

// Longitudes de data-model.md: name 3–100, description ≤ 1 000, product_goal 1–500.
export const ProjectInputSchema = z.object({
  name: z
    .string('El nombre es obligatorio.')
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.'),
  description: z.string('La descripción es obligatoria.').trim().max(1000, 'La descripción no puede superar 1 000 caracteres.'),
  productGoal: z
    .string('El objetivo del producto es obligatorio.')
    .trim()
    .min(1, 'El objetivo del producto es obligatorio.')
    .max(500, 'El objetivo del producto no puede superar 500 caracteres.'),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectUpdateSchema = ProjectInputSchema.extend(ExpectedVersionSchema.shape);
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;

export const AddMemberSchema = z.object({ email: EmailSchema, role: RoleSchema });
export const ChangeRoleSchema = z.object({ role: RoleSchema });

export const EvidenceInputSchema = z.object({
  content: z
    .string('La evidencia es obligatoria.')
    .trim()
    .min(1, 'La evidencia es obligatoria.')
    .max(2000, 'La evidencia no puede superar 2 000 caracteres.'),
});

export const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
});
