import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import { AppError } from './errors.js';

export const SESSION_COOKIE = 'sid';
export const ANON_COOKIE = 'anon';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Token CSRF derivado (HMAC) de la cookie de sesión o, sin sesión, de la cookie anónima. */
export function csrfTokenFor(config: Config, seed: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(`csrf:${seed}`).digest('hex');
}

export function csrfSeed(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE] ?? request.cookies[ANON_COOKIE];
}

function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function originAllowed(request: FastifyRequest, config: Config): boolean {
  const origin = request.headers.origin;
  if (!origin) return true; // peticiones de mismo origen sin cabecera (herramientas, pruebas)
  if (config.CORS_ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    return new URL(origin).host === request.host;
  } catch {
    return false;
  }
}

/**
 * Protección CSRF de doble defensa (research.md D-03): verifica `Origin` y el token
 * `X-CSRF-Token` en todo método que modifica estado bajo /api.
 */
export function registerCsrfProtection(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method) || !request.url.startsWith('/api/')) return;
    const forbidden = () => AppError.forbidden('La solicitud no es válida (protección CSRF). Recargue la página e intente de nuevo.');
    if (!originAllowed(request, request.server.config)) throw forbidden();
    const seed = csrfSeed(request);
    const header = request.headers['x-csrf-token'];
    if (!seed || typeof header !== 'string') throw forbidden();
    if (!sameToken(header, csrfTokenFor(request.server.config, seed))) throw forbidden();
  });
}
