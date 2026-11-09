import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvaluateRequestSchema, GateExceptionInputSchema, StageTypeSchema, ValidationQuerySchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { completeStage, criteriaCatalog, evaluateGate, getRun, grantException, listRuns } from './service.js';

const RunParams = z.object({ projectId: z.uuid(), validationId: z.uuid() });
const StageParams = z.object({ projectId: z.uuid(), sprintId: z.uuid(), stageType: StageTypeSchema });

export interface FlowOptions {
  /**
   * Gancho opcional (lo conecta la capa HTTP al agente): pide retroalimentación de IA para una
   * evaluación recién creada. Si falla, la evaluación por reglas no se ve afectada.
   */
  requestFeedback?: (ctx: { userId: string; projectId: string; runId: string }) => Promise<unknown>;
}

export async function flowRoutes(app: FastifyInstance, options: FlowOptions = {}): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const facilitator = [requireAuth, requireProjectRole('FACILITATOR')];

  // Catálogo de compuertas y criterios con su origen oficial/adicional (FR-017).
  app.get('/criteria-catalog', { preHandler: requireAuth }, async () => criteriaCatalog());

  app.post('/projects/:projectId/validations', { preHandler: anyMember }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = EvaluateRequestSchema.parse(request.body);
    const run = await evaluateGate(app.db, app.clock, request.user!.id, projectId, input);
    if (input.requestAiFeedback && options.requestFeedback) {
      // La compuerta ya está decidida y guardada; la IA solo añade observaciones (si puede).
      await options.requestFeedback({ userId: request.user!.id, projectId, runId: run.id }).catch(() => undefined);
      return reply.status(201).send(await getRun(app.db, projectId, run.id));
    }
    return reply.status(201).send(run);
  });

  app.get('/projects/:projectId/validations', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const filter = ValidationQuerySchema.parse(request.query);
    return listRuns(app.db, projectId, filter);
  });

  app.get('/projects/:projectId/validations/:validationId', { preHandler: anyMember }, async (request) => {
    const parsed = RunParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la evaluación.');
    return getRun(app.db, parsed.data.projectId, parsed.data.validationId);
  });

  // Excepción manual justificada: solo el Facilitador del proyecto (FR-016).
  app.post('/projects/:projectId/validations/:validationId/exception', { preHandler: facilitator }, async (request, reply) => {
    const parsed = RunParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la evaluación.');
    const input = GateExceptionInputSchema.parse(request.body);
    const exception = await grantException(app.db, app.clock, request.user!.id, parsed.data.projectId, parsed.data.validationId, input);
    return reply.status(201).send(exception);
  });

  // Completar/avanzar una etapa: las etapas con compuerta bloqueante exigen su aprobación (FR-013).
  app.post('/projects/:projectId/sprints/:sprintId/stages/:stageType/complete', { preHandler: anyMember }, async (request) => {
    const parsed = StageParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró la etapa.');
    const { projectId, sprintId, stageType } = parsed.data;
    return completeStage(app.db, app.clock, request.user!.id, projectId, sprintId, stageType);
  });
}
