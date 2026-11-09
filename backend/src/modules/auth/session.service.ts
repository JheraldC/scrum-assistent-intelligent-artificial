import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import type { AuthUser } from '../../platform/request-context.js';
import { csrfTokenFor } from '../../platform/csrf.js';
import type { Config } from '../../platform/config.js';

/** Caducidad absoluta de la sesión: 7 días (research.md D-03). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Crea una sesión nueva: el token opaco va en la cookie y en BD solo se guarda su hash. */
export async function createSession(db: Db, config: Config, clock: Clock, userId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      csrfTokenHash: sha256(csrfTokenFor(config, token)),
      expiresAt,
      createdAt: now,
    },
  });
  return { token, expiresAt };
}

/** Devuelve la persona de una sesión válida (no caducada) o `null`. */
export async function findSessionUser(db: Db, clock: Clock, token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= clock.now().getTime()) return null;
  return { id: session.user.id, email: session.user.email, pseudonym: session.user.pseudonym };
}

/** Revoca una sesión (cierre de sesión o rotación al iniciar otra). */
export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}
