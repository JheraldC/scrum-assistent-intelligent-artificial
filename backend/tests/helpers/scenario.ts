import type { FastifyInstance } from 'fastify';
import { createProject, createUser, type TestUser } from './factories.js';

export const historiaBuena = {
  kind: 'USER_STORY',
  title: 'Registrar asistencia del equipo',
  asA: 'Scrum Master',
  iWant: 'registrar la asistencia diaria del equipo en la reunión',
  soThat: 'puedo detectar ausencias recurrentes a tiempo',
  acceptanceCriteria: ['Se guarda la fecha y la hora del registro', 'Solo el Scrum Master puede modificar un registro guardado'],
  priority: 1,
};

export const planBueno = {
  sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel',
  workPlan: 'HU-1: diseñar el formulario de asistencia. Luego implementar el registro de asistencia y probarlo.',
};

export interface SprintDto {
  id: string;
  version: number;
  sprintGoal: string;
  workPlan: string;
  itemIds: string[];
  stages: { type: string; status: string; completedAt: string | null; gateState?: string | null }[];
}

export interface Scenario {
  ana: TestUser;
  projectId: string;
  sprintId: string;
  storyId: string;
  base: string;
}

/** Proyecto con una historia aprobada y un Sprint abierto vacío. */
export async function createScenario(app: FastifyInstance, options: { approveStory?: boolean } = {}): Promise<Scenario> {
  const ana = await createUser(app, 'ana');
  const project = await createProject(ana);
  const story = (await ana.client.post(`/projects/${project.id}/backlog`, historiaBuena)).json() as { id: string };
  if (options.approveStory ?? true) {
    await ana.client.post(`/projects/${project.id}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: story.id });
  }
  const sprint = (await ana.client.post(`/projects/${project.id}/sprints`)).json() as SprintDto;
  return { ana, projectId: project.id, sprintId: sprint.id, storyId: story.id, base: `/projects/${project.id}/sprints/${sprint.id}` };
}

export async function getSprint(s: Scenario, user: TestUser = s.ana): Promise<SprintDto> {
  return (await user.client.get(s.base)).json() as SprintDto;
}

/** Rellena objetivo, plan y elementos; devuelve el Sprint resultante. */
export async function fillPlan(s: Scenario, overrides: Partial<typeof planBueno> = {}, itemIds: string[] = [s.storyId]): Promise<SprintDto> {
  const sprint = await getSprint(s);
  const patched = await s.ana.client.patch(s.base, { ...planBueno, ...overrides, expectedVersion: sprint.version });
  if (patched.statusCode !== 200) throw new Error(`PATCH del Sprint falló: ${patched.body}`);
  const put = await s.ana.client.put(`${s.base}/items`, { itemIds, expectedVersion: (patched.json() as SprintDto).version });
  if (put.statusCode !== 200) throw new Error(`PUT de elementos falló: ${put.body}`);
  return put.json() as SprintDto;
}

export const evaluatePlan = (s: Scenario, user: TestUser = s.ana) =>
  user.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: s.sprintId });

export const completeStage = (s: Scenario, type: string, user: TestUser = s.ana) =>
  user.client.post(`${s.base}/stages/${type}/complete`);
