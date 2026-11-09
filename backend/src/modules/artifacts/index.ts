import type { FastifyInstance } from 'fastify';
import { retrospectiveRoutes } from './retrospective/routes.js';
import { reviewRoutes } from './review/routes.js';
import { trackingRoutes } from './tracking/routes.js';

export { getRetroSnapshot } from './retrospective/service.js';
export { getReviewSnapshot } from './review/service.js';

/** Artefactos del Sprint: seguimiento, Review y retrospectiva. */
export async function artifactsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(trackingRoutes);
  await app.register(reviewRoutes);
  await app.register(retrospectiveRoutes);
}
