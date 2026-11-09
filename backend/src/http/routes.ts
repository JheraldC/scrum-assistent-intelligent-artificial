import type { FastifyInstance } from 'fastify';
import { registerCsrfProtection } from '../platform/csrf.js';
import { activityRoutes } from '../modules/activity/index.js';
import { authRoutes } from '../modules/auth/index.js';
import { projectsRoutes } from '../modules/projects/index.js';
import { sprintsRoutes } from '../modules/sprints/index.js';

/**
 * Registro central de rutas bajo /api/v1. Cada historia añade aquí su módulo
 * (backlog, flow, agent, ...) como un plugin.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  registerCsrfProtection(app);
  await app.register(
    async (api) => {
      api.get('/health', async () => ({ status: 'ok' as const }));
      await api.register(authRoutes);
      await api.register(projectsRoutes);
      await api.register(sprintsRoutes);
      await api.register(activityRoutes);
    },
    { prefix: '/api/v1' },
  );
}
