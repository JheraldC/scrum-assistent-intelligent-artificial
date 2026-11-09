import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { createProject, createUser } from '../helpers/factories.js';
import { createScenario, evaluatePlan, fillPlan, getRetro, getSprint, retroBuena, retroUrl, type Scenario } from '../helpers/scenario.js';

/** Concurrencia (T075, FR-036, SC-003). La fase final (T136) amplía este archivo. */
describe('ejecución concurrente', () => {
  let t: TestApp;
  let s: Scenario;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    s = await createScenario(t.app);
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('dos PATCH del Sprint con la misma versión: uno gana y el otro recibe 409', async () => {
    const [a, b] = await Promise.all([
      s.ana.client.patch(s.base, { sprintGoal: 'Objetivo A', expectedVersion: 1 }),
      s.ana.client.patch(s.base, { sprintGoal: 'Objetivo B', expectedVersion: 1 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await getSprint(s)).version).toBe(2);
  });

  it('diez evaluaciones simultáneas del mismo Sprint obtienen intentos distintos y consecutivos', async () => {
    await fillPlan(s);
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => evaluatePlan(s)));
    expect(respuestas.every((r) => r.statusCode === 201)).toBe(true);
    const intentos = respuestas.map((r) => (r.json() as { attemptNo: number }).attemptNo).sort((a, b) => a - b);
    expect(intentos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await getTestDb().validationRun.count({ where: { targetId: s.sprintId } })).toBe(10);
  });

  it('evaluar mientras se edita nunca produce una evaluación de una versión inexistente', async () => {
    await fillPlan(s);
    const sprint = await getSprint(s);
    const [evaluacion, edicion] = await Promise.all([
      evaluatePlan(s),
      s.ana.client.patch(s.base, { workPlan: `${sprint.workPlan} Más detalles de HU-1.`, expectedVersion: sprint.version }),
    ]);
    expect(evaluacion.statusCode).toBe(201);
    expect([200, 409]).toContain(edicion.statusCode);
    const final = await getSprint(s);
    const run = evaluacion.json() as { targetVersion: number };
    // La evaluación corresponde a una versión que existió realmente.
    expect(run.targetVersion).toBeLessThanOrEqual(final.version);
    expect(run.targetVersion).toBeGreaterThanOrEqual(sprint.version);
  });

  it('dos creaciones simultáneas de Sprint producen un solo Sprint abierto', async () => {
    const beto = await createUser(t.app, 'beto');
    const pb = await createProject(beto);
    const [a, b] = await Promise.all([beto.client.post(`/projects/${pb.id}/sprints`), beto.client.post(`/projects/${pb.id}/sprints`)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(await getTestDb().sprint.count({ where: { projectId: pb.id, status: 'OPEN' } })).toBe(1);
  });

  it('dos PUT de elementos con la misma versión: uno gana y el otro recibe 409', async () => {
    const [a, b] = await Promise.all([
      s.ana.client.put(`${s.base}/items`, { itemIds: [s.storyId], expectedVersion: 1 }),
      s.ana.client.put(`${s.base}/items`, { itemIds: [], expectedVersion: 1 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });

  it('dos Facilitadores que se degradan a la vez: el proyecto conserva al menos uno (T137)', async () => {
    const beto = await createUser(t.app, 'beto');
    await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'FACILITATOR' });
    const [a, b] = await Promise.all([
      s.ana.client.patch(`/projects/${s.projectId}/members/${beto.id}`, { role: 'PARTICIPANT' }),
      beto.client.patch(`/projects/${s.projectId}/members/${s.ana.id}`, { role: 'PARTICIPANT' }),
    ]);
    // Uno de los dos puede perder el permiso antes de actuar (403); nunca quedan cero Facilitadores.
    expect([a.statusCode, b.statusCode].some((c) => c === 200)).toBe(true);
    expect(await getTestDb().projectMember.count({ where: { projectId: s.projectId, role: 'FACILITATOR' } })).toBeGreaterThanOrEqual(1);
  });

  it('dos Facilitadores que se quitan a la vez: el proyecto conserva al menos uno (T137)', async () => {
    const beto = await createUser(t.app, 'beto');
    await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'FACILITATOR' });
    await Promise.all([
      s.ana.client.delete(`/projects/${s.projectId}/members/${beto.id}`),
      beto.client.delete(`/projects/${s.projectId}/members/${s.ana.id}`),
    ]);
    expect(await getTestDb().projectMember.count({ where: { projectId: s.projectId, role: 'FACILITATOR' } })).toBeGreaterThanOrEqual(1);
  });

  it('dos PUT simultáneos de la retrospectiva con la misma versión: uno gana y el otro recibe 409 (T137)', async () => {
    const retro = await getRetro(s);
    const [a, b] = await Promise.all([
      s.ana.client.put(retroUrl(s), { ...retroBuena, positives: ['A'], expectedVersion: retro.version }),
      s.ana.client.put(retroUrl(s), { ...retroBuena, positives: ['B'], expectedVersion: retro.version }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await getRetro(s)).version).toBe(retro.version + 1);
  });
});
