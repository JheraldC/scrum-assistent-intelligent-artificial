import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Config } from './platform/config.js';
import type { Db } from './platform/db.js';
import { systemClock, type Clock } from './platform/clock.js';
import { errorHandler, notFoundHandler } from './platform/errors.js';
import { loggerOptions } from './platform/logger.js';
import { registerRoutes } from './http/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Db;
    clock: Clock;
  }
}

export interface AppDeps {
  config: Config;
  db: Db;
  clock?: Clock;
  /** Directorio del frontend compilado; por defecto `frontend/dist` junto al repositorio. */
  staticDir?: string;
}

/** Fábrica de la instancia Fastify (testeable: no abre puertos ni lee el entorno). */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : loggerOptions(config.NODE_ENV === 'production' ? 'info' : 'debug'),
    genReqId: () => randomUUID(),
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.decorate('config', config);
  app.decorate('db', deps.db);
  app.decorate('clock', deps.clock ?? systemClock);

  await app.register(helmet, { global: true });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  // global: false → los límites se declaran por ruta (inicio de sesión, registro, IA).
  await app.register(rateLimit, { global: false });
  // Mismo origen por defecto: CORS cerrado salvo una lista blanca explícita (nunca comodines).
  await app.register(cors, {
    origin: config.CORS_ALLOWED_ORIGINS.length > 0 ? config.CORS_ALLOWED_ORIGINS : false,
    credentials: config.CORS_ALLOWED_ORIGINS.length > 0,
  });

  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  // En producción el mismo servidor entrega el frontend compilado (research.md D-02).
  const staticDir = deps.staticDir ?? path.resolve(import.meta.dirname, '..', '..', 'frontend', 'dist');
  if (config.NODE_ENV === 'production' && existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return notFoundHandler(request, reply);
      return reply.sendFile('index.html'); // rutas del cliente (React Router)
    });
  } else {
    app.setNotFoundHandler(notFoundHandler);
  }

  return app;
}
