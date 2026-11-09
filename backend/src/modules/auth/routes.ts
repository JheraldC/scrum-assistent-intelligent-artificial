import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CredentialsSchema } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { ANON_COOKIE, SESSION_COOKIE, csrfSeed, csrfTokenFor } from '../../platform/csrf.js';
import '../../platform/request-context.js';
import { LoginAttemptLimiter, login, register } from './service.js';
import { findSessionUser, revokeSession, SESSION_TTL_MS } from './session.service.js';

/** Gancho de autenticación: rellena `request.user` o responde 401. */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  const user = token ? await findSessionUser(request.server.db, request.server.clock, token) : null;
  if (!user) throw AppError.unauthenticated();
  request.user = user;
}

function cookieOptions(app: FastifyInstance, maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: app.config.NODE_ENV !== 'development',
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAgeMs ? { maxAge: Math.floor(maxAgeMs / 1000) } : {}),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const limiter = new LoginAttemptLimiter(app.clock);
  // Límite por IP (30/min); en pruebas se amplía para no interferir con los casos de uso repetidos.
  const perIp = { rateLimit: { max: app.config.NODE_ENV === 'test' ? 10_000 : 30, timeWindow: '1 minute' } };

  app.post('/auth/register', { config: perIp }, async (request, reply) => {
    const credentials = CredentialsSchema.parse(request.body);
    const me = await register(app.db, app.clock, credentials);
    return reply.status(201).send(me);
  });

  app.post('/auth/login', { config: perIp }, async (request, reply) => {
    const credentials = CredentialsSchema.parse(request.body);
    const { me, session } = await login(
      app.db,
      app.config,
      app.clock,
      limiter,
      credentials,
      request.cookies[SESSION_COOKIE],
    );
    reply.setCookie(SESSION_COOKIE, session.token, cookieOptions(app, SESSION_TTL_MS));
    return reply.send(me);
  });

  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await revokeSession(app.db, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => request.user);

  app.get('/auth/csrf', async (request, reply) => {
    let seed = csrfSeed(request);
    if (!seed) {
      seed = randomBytes(24).toString('base64url');
      reply.setCookie(ANON_COOKIE, seed, cookieOptions(app));
    }
    return reply.header('cache-control', 'no-store').send({ csrfToken: csrfTokenFor(app.config, seed) });
  });
}
