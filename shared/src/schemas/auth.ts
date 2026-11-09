import { z } from 'zod';

/** Pseudónimo de cuenta (data-model.md): `P-` + 6 caracteres de A-Z y 2-9. */
export const PSEUDONYM_PATTERN = /^P-[A-Z2-9]{6}$/;

export const EmailSchema = z
  .string('El correo es obligatorio.')
  .trim()
  .toLowerCase()
  .max(254, 'El correo no puede superar 254 caracteres.')
  .pipe(z.email('Escriba un correo electrónico válido.'));

export const CredentialsSchema = z.object({
  email: EmailSchema,
  password: z
    .string('La contraseña es obligatoria.')
    .min(10, 'La contraseña debe tener al menos 10 caracteres.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

export const MeSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  pseudonym: z.string().regex(PSEUDONYM_PATTERN),
});
export type Me = z.infer<typeof MeSchema>;
