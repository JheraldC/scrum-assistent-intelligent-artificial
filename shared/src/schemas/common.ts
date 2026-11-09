import { z } from 'zod';

/** Control de versión optimista (research.md D-06): se exige en cada modificación de artefactos. */
export const ExpectedVersionSchema = z.object({
  expectedVersion: z.number('Falta la versión esperada.').int().min(1),
});
export type ExpectedVersion = z.infer<typeof ExpectedVersionSchema>;

export const UuidSchema = z.uuid('Identificador no válido.');
