import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ChatRequestSchema, SUGGESTION_STATUSES, SuggestionResolveSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { getRun } from '../flow/index.js';
import { AgentBudget, PrismaBudgetStore } from './budget.js';
import { createLlmProvider, type LlmProvider } from './llm/index.js';
import { AgentService } from './service.js';
import { listSuggestions, resolveSuggestion } from './suggestions.js';

const RunParams = z.object({ projectId: z.uuid(), validationId: z.uuid() });
const SuggestionParams = z.object({ projectId: z.uuid(), suggestionId: z.uuid() });
const SuggestionQuery = z.object({ status: z.enum(SUGGESTION_STATUSES).optional() });

/** Crea el servicio del agente con la configuración y el reloj de la aplicación. */
export function createAgentService(app: FastifyInstance, llm?: LlmProvider): AgentService {
  const { config } = app;
  const budget = new AgentBudget(new PrismaBudgetStore(app.db), app.clock, {
    userRatePerMinute: config.AI_USER_RATE_PER_MINUTE,
    dailyTokenBudgetGlobal: config.AI_DAILY_TOKEN_BUDGET_GLOBAL,
    dailyTokenBudgetPerProject: config.AI_DAILY_TOKEN_BUDGET_PER_PROJECT,
  });
  return new AgentService({ db: app.db, llm: llm ?? createLlmProvider(config), budget, clock: app.clock, config });
}

export async function agentRoutes(app: FastifyInstance, options: { service: AgentService }): Promise<void> {
  const { service } = options;
  const anyMember = [requireAuth, requireProjectRole()];

  // Preguntar al asistente con el contexto del proyecto. No modifica artefactos (FR-020, FR-021).
  app.post('/projects/:projectId/agent/chat', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const input = ChatRequestSchema.parse(request.body);
    return service.chat(request.user!.id, projectId, input);
  });

  // Historial de interacciones: modelo, versión de prompt y estado (FR-025).
  app.get('/projects/:projectId/agent/interactions', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return service.listInteractions(projectId);
  });

  // Retroalimentación de IA bajo demanda sobre una evaluación existente: no cambia su estado.
  app.post('/projects/:projectId/validations/:validationId/ai-feedback', { preHandler: anyMember }, async (request) => {
    const parsed = RunParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la evaluación.');
    await service.feedbackForRun(request.user!.id, parsed.data.projectId, parsed.data.validationId);
    return getRun(app.db, parsed.data.projectId, parsed.data.validationId);
  });

  // Propuestas de la IA pendientes de decisión humana. Solo esta acción explícita puede aplicarlas.
  app.get('/projects/:projectId/agent/suggestions', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const { status } = SuggestionQuery.parse(request.query);
    return listSuggestions(app.db, projectId, status);
  });

  app.post('/projects/:projectId/agent/suggestions/:suggestionId/resolve', { preHandler: anyMember }, async (request) => {
    const parsed = SuggestionParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la sugerencia.');
    const body = SuggestionResolveSchema.parse(request.body);
    return resolveSuggestion(app.db, app.clock, request.user!.id, parsed.data.projectId, parsed.data.suggestionId, body);
  });
}
