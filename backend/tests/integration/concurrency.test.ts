import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { createProject, createUser } from '../helpers/factories.js';
import { createScenario, evaluatePlan, fillPlan, getSprint, type Scenario } from '../helpers/scenario.js';

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
});
