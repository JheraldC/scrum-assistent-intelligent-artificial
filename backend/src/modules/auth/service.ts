import type { Credentials, Me } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import type { Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import type { Config } from '../../platform/config.js';
import { hashPassword, verifyDummy, verifyPassword } from './password.js';
import { generatePseudonym } from './pseudonym.js';
import { createUser, findUserByEmail } from './repository.js';
import { createSession, revokeSession, type CreatedSession } from './session.service.js';

const MAX_PSEUDONYM_ATTEMPTS = 5;

/** Límite de intentos fallidos por correo (además del límite por IP de la ruta). */
export class LoginAttemptLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly clock: Clock,
    private readonly maxFailures = 8,
    private readonly windowMs = 10 * 60 * 1000,
  ) {}

  assertAllowed(email: string): void {
    const entry = this.failures.get(email);
    if (entry && entry.resetAt > this.clock.now().getTime() && entry.count >= this.maxFailures) {
      throw new AppError('RATE_LIMITED', 429, 'Demasiados intentos fallidos. Intente de nuevo en unos minutos.');
    }
  }
  recordFailure(email: string): void {
    const now = this.clock.now().getTime();
    const entry = this.failures.get(email);
    if (!entry || entry.resetAt <= now) this.failures.set(email, { count: 1, resetAt: now + this.windowMs });
    else entry.count += 1;
  }
  reset(email: string): void {
    this.failures.delete(email);
  }
}

export async function register(db: Db, clock: Clock, credentials: Credentials): Promise<Me> {
  const passwordHash = await hashPassword(credentials.password);
  for (let attempt = 0; attempt < MAX_PSEUDONYM_ATTEMPTS; attempt += 1) {
    const result = await createUser(db, {
      email: credentials.email,
      passwordHash,
      pseudonym: generatePseudonym(),
      createdAt: clock.now(),
    });
    if (result.ok) return result.user;
    if (result.reason === 'email-taken') {
      // Decisión de la spec (A. I4): en este prototipo se acepta revelar que el correo ya existe.
      throw AppError.conflict('Ya existe una cuenta con ese correo electrónico.');
    }
  }
  throw new Error('No se pudo generar un seudónimo único');
}

/** Inicio de sesión: mensaje genérico ante correo inexistente o contraseña errónea. */
export async function login(
  db: Db,
  config: Config,
  clock: Clock,
  limiter: LoginAttemptLimiter,
  credentials: Credentials,
  previousToken: string | undefined,
): Promise<{ me: Me; session: CreatedSession }> {
  limiter.assertAllowed(credentials.email);
  const user = await findUserByEmail(db, credentials.email);
  const valid = user ? await verifyPassword(user.passwordHash, credentials.password) : (await verifyDummy(credentials.password), false);
  if (!user || !valid) {
    limiter.recordFailure(credentials.email);
    throw new AppError('UNAUTHENTICATED', 401, 'Correo o contraseña incorrectos.');
  }
  limiter.reset(credentials.email);
  if (previousToken) await revokeSession(db, previousToken); // rotación del identificador de sesión
  const session = await createSession(db, config, clock, user.id);
  return { me: { id: user.id, email: user.email, pseudonym: user.pseudonym }, session };
}
