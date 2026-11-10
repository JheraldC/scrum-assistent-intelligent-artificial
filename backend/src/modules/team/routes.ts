import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DecisionInputSchema, SprintTaskInputSchema, SprintTaskUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { addDecision, listDecisions } from './decisions.service.js';
import { createTask, deleteTask, listTasks, updateTask } from './tasks.service.js';
import { developersView, productOwnerView, scrumMasterView } from './views.service.js';

const SprintParams = z.object({ projectId: z.uuid(), sprintId: z.uuid() });
const TaskParams = SprintParams.extend({ taskId: z.uuid() });

function parse<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw AppError.notFound('No se encontró el recurso solicitado.');
  return parsed.data;
}

/** Tareas opcionales del Sprint, decisiones y vistas por responsabilidad Scrum. */
export async function teamRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];

  // Vistas (solo lectura, visibles para todo el equipo).
  app.get('/projects/:projectId/views/scrum-master', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return scrumMasterView(app.db, projectId, app.clock.now());
  });
  app.get('/projects/:projectId/views/product-owner', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return productOwnerView(app.db, projectId);
  });
  app.get('/projects/:projectId/views/developers', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return developersView(app.db, projectId);
  });

  // Tareas opcionales del Sprint.
  const tasks = '/projects/:projectId/sprints/:sprintId/tasks';
  app.get(tasks, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    return listTasks(app.db, projectId, sprintId);
  });
  app.post(tasks, { preHandler: anyMember }, async (request, reply) => {
    const { projectId, sprintId } = parse(SprintParams, request.params);
    const input = SprintTaskInputSchema.parse(request.body);
    return reply.status(201).send(await createTask(app.db, app.clock, request.user!.id, projectId, sprintId, input));
  });
  app.patch(`${tasks}/:taskId`, { preHandler: anyMember }, async (request) => {
    const { projectId, sprintId, taskId } = parse(TaskParams, request.params);
    const input = SprintTaskUpdateSchema.parse(request.body);
    return updateTask(app.db, app.clock, request.user!.id, projectId, sprintId, taskId, input);
  });
  app.delete(`${tasks}/:taskId`, { preHandler: anyMember }, async (request, reply) => {
    const { projectId, sprintId, taskId } = parse(TaskParams, request.params);
    await deleteTask(app.db, app.clock, request.user!.id, projectId, sprintId, taskId);
    return reply.status(204).send();
  });

  // Decisiones y acuerdos.
  app.get('/projects/:projectId/decisions', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return listDecisions(app.db, projectId);
  });
  app.post('/projects/:projectId/decisions', { preHandler: anyMember }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const input = DecisionInputSchema.parse(request.body);
    return reply.status(201).send(await addDecision(app.db, app.clock, request.user!.id, projectId, input));
  });
}
