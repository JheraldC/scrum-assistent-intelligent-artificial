import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { createProject, createUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, getSprint, historiaBuena, planBueno, type Scenario, type SprintDto } from '../helpers/scenario.js';

describe('planificación del Sprint (T072, FR-011, FR-036)', () => {
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

  it('define el Sprint Goal y el plan con la versión vigente', async () => {
    const res = await s.ana.client.patch(s.base, { ...planBueno, expectedVersion: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ...planBueno, version: 2 });
  });

  it('permite actualizar solo el objetivo o solo el plan', async () => {
    const a = await s.ana.client.patch(s.base, { sprintGoal: 'Solo objetivo', expectedVersion: 1 });
    expect(a.json()).toMatchObject({ sprintGoal: 'Solo objetivo', workPlan: '', version: 2 });
    const b = await s.ana.client.patch(s.base, { workPlan: 'Solo plan', expectedVersion: 2 });
    expect(b.json()).toMatchObject({ sprintGoal: 'Solo objetivo', workPlan: 'Solo plan', version: 3 });
  });

  it('versión desactualizada: 409 con el estado actual', async () => {
    await s.ana.client.patch(s.base, { sprintGoal: 'Primero', expectedVersion: 1 });
    const stale = await s.ana.client.patch(s.base, { sprintGoal: 'Tarde', expectedVersion: 1 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe('VERSION_CONFLICT');
    expect(stale.json().current.sprintGoal).toBe('Primero');
  });

  it.each([
    ['objetivo de 501 caracteres', { sprintGoal: 'x'.repeat(501) }],
    ['plan de 5001 caracteres', { workPlan: 'y'.repeat(5001) }],
    ['sin ningún campo', {}],
  ])('rechaza %s con 422', async (_caso, body) => {
    const res = await s.ana.client.patch(s.base, { ...body, expectedVersion: 1 });
    expect(res.statusCode).toBe(422);
  });

  it('cualquier miembro edita el plan (también un Participante)', async () => {
    const beto = await createUser(t.app, 'beto');
    await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'PARTICIPANT' });
    const res = await beto.client.patch(s.base, { sprintGoal: 'Por Beto', expectedVersion: 1 });
    expect(res.statusCode).toBe(200);
  });

  describe('selección de elementos del Product Backlog', () => {
    it('reemplaza la selección, incrementa la versión y la devuelve en itemIds', async () => {
      const sprint = await getSprint(s);
      const res = await s.ana.client.put(`${s.base}/items`, { itemIds: [s.storyId], expectedVersion: sprint.version });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ itemIds: [s.storyId], version: sprint.version + 1 });
      expect((await getSprint(s)).itemIds).toEqual([s.storyId]);
      const vacio = await s.ana.client.put(`${s.base}/items`, { itemIds: [], expectedVersion: sprint.version + 1 });
      expect(vacio.json().itemIds).toEqual([]);
    });

    it('ignora identificadores duplicados', async () => {
      const sprint = await getSprint(s);
      const res = await s.ana.client.put(`${s.base}/items`, { itemIds: [s.storyId, s.storyId], expectedVersion: sprint.version });
      expect(res.json().itemIds).toEqual([s.storyId]);
    });

    it('rechaza elementos de otro proyecto (422)', async () => {
      const beto = await createUser(t.app, 'beto');
      const pb = await createProject(beto);
      const ajeno = (await beto.client.post(`/projects/${pb.id}/backlog`, historiaBuena)).json() as { id: string };
      const sprint = await getSprint(s);
      const res = await s.ana.client.put(`${s.base}/items`, { itemIds: [ajeno.id], expectedVersion: sprint.version });
      expect(res.statusCode).toBe(422);
      expect((await getSprint(s)).itemIds).toEqual([]);
    });

    it('rechaza identificadores mal formados (422) y versión vieja (409)', async () => {
      expect((await s.ana.client.put(`${s.base}/items`, { itemIds: ['no-uuid'], expectedVersion: 1 })).statusCode).toBe(422);
      await s.ana.client.patch(s.base, { sprintGoal: 'cambio', expectedVersion: 1 });
      expect((await s.ana.client.put(`${s.base}/items`, { itemIds: [s.storyId], expectedVersion: 1 })).statusCode).toBe(409);
    });
  });

  describe('etapa de planificación al editar', () => {
    it('el primer cambio mueve la etapa a IN_PROGRESS', async () => {
      await s.ana.client.patch(s.base, { sprintGoal: 'Empezamos', expectedVersion: 1 });
      const planning = (await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!;
      expect(planning.status).toBe('IN_PROGRESS');
    });

    it('editar tras validar pasa la etapa a NEEDS_CORRECTION y la compuerta a DESACTUALIZADA', async () => {
      await fillPlan(s);
      expect((await evaluatePlan(s)).json().status).toBe('PASSED');
      expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
      let planning = (await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!;
      expect(planning).toMatchObject({ status: 'VALIDATED', gateState: 'APROBADA' });

      const sprint = await getSprint(s);
      await s.ana.client.patch(s.base, { sprintGoal: 'Un objetivo distinto del anterior para el equipo', expectedVersion: sprint.version });
      planning = (await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!;
      expect(planning.status).toBe('NEEDS_CORRECTION');
      expect(planning.gateState).toBe('DESACTUALIZADA');
      expect(planning.completedAt).toBeNull();
    });
  });

  it('el detalle del proyecto muestra REQUIERE_CORRECCION cuando una etapa lo necesita', async () => {
    await fillPlan(s);
    await evaluatePlan(s);
    await completeStage(s, 'PLANNING');
    const sprint = await getSprint(s);
    await s.ana.client.patch(s.base, { sprintGoal: 'Cambiamos de objetivo después de validar', expectedVersion: sprint.version });
    const detail = (await s.ana.client.get(`/projects/${s.projectId}`)).json() as { status: string };
    expect(detail.status).toBe('REQUIERE_CORRECCION');
  });

  it('un Sprint de otro proyecto no se puede editar (404)', async () => {
    const beto = await createUser(t.app, 'beto');
    const pb = await createProject(beto);
    const res = await beto.client.patch(`/projects/${pb.id}/sprints/${s.sprintId}`, { sprintGoal: 'intruso', expectedVersion: 1 });
    expect(res.statusCode).toBe(404);
  });

  it('un Sprint cerrado no admite cambios (409)', async () => {
    const { getTestDb } = await import('../helpers/db.js');
    await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
    const res = await s.ana.client.patch(s.base, { sprintGoal: 'tarde', expectedVersion: 1 });
    expect(res.statusCode).toBe(409);
    const sprint = (await s.ana.client.get(s.base)).json() as SprintDto;
    expect(sprint.sprintGoal).toBe('');
  });
});
