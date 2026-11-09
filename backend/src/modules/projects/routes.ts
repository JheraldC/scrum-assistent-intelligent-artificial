import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AddMemberSchema, ChangeRoleSchema, ProjectInputSchema, ProjectUpdateSchema } from '@scrum/shared';
import { requireProjectRole } from '../../platform/access.js';
import { AppError } from '../../platform/errors.js';
import { requireAuth } from '../auth/index.js';
import { addMember, changeRole, listMembers, removeMember } from './members.service.js';
import { createProject, getProjectDetail, listProjects, updateProject } from './service.js';

const MemberParams = z.object({ projectId: z.uuid(), userId: z.uuid() });

export async function projectsRoutes(app: FastifyInstance): Promise<void> {
  const anyMember = [requireAuth, requireProjectRole()];
  const facilitator = [requireAuth, requireProjectRole('FACILITATOR')];

  app.get('/projects', { preHandler: requireAuth }, async (request) => listProjects(app.db, request.user!.id));

  app.post('/projects', { preHandler: requireAuth }, async (request, reply) => {
    const input = ProjectInputSchema.parse(request.body);
    return reply.status(201).send(await createProject(app.db, app.clock, request.user!.id, input));
  });

  app.get('/projects/:projectId', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return getProjectDetail(app.db, projectId, request.membership!.role);
  });

  app.patch('/projects/:projectId', { preHandler: facilitator }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    const input = ProjectUpdateSchema.parse(request.body);
    return updateProject(app.db, app.clock, request.user!.id, projectId, input);
  });

  app.get('/projects/:projectId/members', { preHandler: anyMember }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    return listMembers(app.db, projectId, request.membership!.role);
  });

  app.post('/projects/:projectId/members', { preHandler: facilitator }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { email, role } = AddMemberSchema.parse(request.body);
    return reply.status(201).send(await addMember(app.db, app.clock, request.user!.id, projectId, email, role));
  });

  app.patch('/projects/:projectId/members/:userId', { preHandler: facilitator }, async (request) => {
    const parsed = MemberParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró a esa persona en el proyecto.');
    const { role } = ChangeRoleSchema.parse(request.body);
    return changeRole(app.db, app.clock, request.user!.id, parsed.data.projectId, parsed.data.userId, role);
  });

  app.delete('/projects/:projectId/members/:userId', { preHandler: facilitator }, async (request, reply) => {
    const parsed = MemberParams.safeParse(request.params);
    if (!parsed.success) throw AppError.notFound('No se encontró a esa persona en el proyecto.');
    await removeMember(app.db, app.clock, request.user!.id, parsed.data.projectId, parsed.data.userId);
    return reply.status(204).send();
  });
}
