import type { FastifyInstance } from 'fastify';
import { retrospectiveRoutes } from './retrospective/routes.js';

export { getRetroSnapshot } from './retrospective/service.js';

/** Artefactos del Sprint: retrospectiva (US5); seguimiento y Review se añaden en US7. */
export async function artifactsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(retrospectiveRoutes);
}
