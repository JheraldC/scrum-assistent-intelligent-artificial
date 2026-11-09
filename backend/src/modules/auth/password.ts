import argon2 from 'argon2';

/** Hash de contraseñas con Argon2id (research.md D-04). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Verificación ficticia para igualar tiempos cuando el correo no existe (evita enumeración por tiempo). */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('contraseña-ficticia-no-valida');
  await verifyPassword(await dummyHash, password);
}
