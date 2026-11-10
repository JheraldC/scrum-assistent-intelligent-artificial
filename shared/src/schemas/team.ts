import { z } from 'zod';
import { ExpectedVersionSchema } from './common.js';

// Responsabilidades Scrum por proyecto. Son independientes de los permisos técnicos
// (Facilitador / Participante): una persona puede tener varias o ninguna.
export const SCRUM_RESPONSIBILITIES = ['SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER'] as const;
export type ScrumResponsibility = (typeof SCRUM_RESPONSIBILITIES)[number];
export const ScrumResponsibilitySchema = z.enum(SCRUM_RESPONSIBILITIES, 'Responsabilidad no válida.');

export const MemberResponsibilitiesSchema = z.object({
  responsibilities: z
    .array(ScrumResponsibilitySchema)
    .max(SCRUM_RESPONSIBILITIES.length, 'Demasiadas responsabilidades.')
    .refine((list) => new Set(list).size === list.length, 'No repita responsabilidades.'),
});
export type MemberResponsibilities = z.infer<typeof MemberResponsibilitiesSchema>;

// Tareas opcionales del Sprint.
export const TASK_STATUSES = ['TODO', 'DOING', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const taskTitle = z
  .string('El título de la tarea es obligatorio.')
  .trim()
  .min(1, 'El título de la tarea es obligatorio.')
  .max(200, 'El título de la tarea no puede superar 200 caracteres.');

export const SprintTaskInputSchema = z.object({
  title: taskTitle,
  backlogItemId: z.uuid('Elemento no válido.').nullable().optional(),
  // La asignación es una opción del equipo, nunca un requisito.
  assigneeId: z.uuid('Responsable no válido.').nullable().optional(),
  status: z.enum(TASK_STATUSES, 'Estado de la tarea no válido.').optional(),
});
export type SprintTaskInput = z.infer<typeof SprintTaskInputSchema>;

export const SprintTaskUpdateSchema = SprintTaskInputSchema.partial()
  .extend(ExpectedVersionSchema.shape)
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), { message: 'Indique qué desea cambiar.', path: ['title'] });
export type SprintTaskUpdate = z.infer<typeof SprintTaskUpdateSchema>;

// Decisiones y acuerdos del proyecto.
export const DECISION_KINDS = ['DECISION', 'AGREEMENT'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const DecisionInputSchema = z.object({
  kind: z.enum(DECISION_KINDS, 'Tipo no válido.'),
  text: z
    .string('El texto es obligatorio.')
    .trim()
    .min(1, 'El texto es obligatorio.')
    .max(1000, 'El texto no puede superar 1 000 caracteres.'),
});
export type DecisionInput = z.infer<typeof DecisionInputSchema>;

// Documentación permanente.
export const DOCUMENT_STATUSES = ['ACTIVE', 'OUTDATED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DocumentUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'El nombre no puede superar 120 caracteres.').optional(),
    status: z.enum(DOCUMENT_STATUSES, 'Estado no válido.').optional(),
    includeInContext: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Indique qué desea cambiar.', path: ['name'] });
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;

// Sugerencias de la IA (propuestas revisables).
export const SUGGESTION_KINDS = ['STORY', 'ACCEPTANCE_CRITERIA', 'TASK', 'RISK', 'DEPENDENCY', 'QUESTION'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_STATUSES = ['PROPOSED', 'ACCEPTED', 'DISCARDED'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Campos que la persona puede editar antes de aceptar. Todos opcionales: lo no editado se conserva. */
export const SuggestionEditSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    text: z.string().trim().min(1).max(800).optional(),
    asA: z.string().trim().max(200).optional(),
    iWant: z.string().trim().max(500).optional(),
    soThat: z.string().trim().max(500).optional(),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
    /** Elemento del Product Backlog destino (criterios de aceptación y tareas). */
    itemId: z.uuid().nullable().optional(),
  })
  .strict();
export type SuggestionEdit = z.infer<typeof SuggestionEditSchema>;

export const SuggestionResolveSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACCEPT'), confirm: z.literal(true, 'Confirme el cambio para aplicarlo.'), edit: SuggestionEditSchema.optional() }),
  z.object({ action: z.literal('DISCARD') }),
]);
export type SuggestionResolve = z.infer<typeof SuggestionResolveSchema>;
