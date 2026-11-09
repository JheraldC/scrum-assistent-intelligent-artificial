import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser } from '../helpers/factories.js';

interface Stage {
  type: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

describe('Sprint, etapas y evidencia (T029, FR-005, FR-006, FR-011)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(resetDb);
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('crear un Sprint crea 4 etapas en PENDING y en el orden del flujo', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const res = await ana.client.post(`/projects/${p.id}/sprints`);
    expect(res.statusCode).toBe(201);
    const sprint = res.json() as { number: number; status: string; version: number; stages: Stage[] };
    expect(sprint).toMatchObject({ number: 1, status: 'OPEN', version: 1 });
    expect(sprint.stages.map((s) => s.type)).toEqual(['PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE']);
    expect(sprint.stages.every((s) => s.status === 'PENDING')).toBe(true);
  });

  it('el detalle del proyecto muestra el Sprint abierto y el estado derivado', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    await ana.client.post(`/projects/${p.id}/sprints`);
    const detail = (await ana.client.get(`/projects/${p.id}`)).json() as {
      status: string;
      openSprint: { stages: Stage[] } | null;
    };
    expect(detail.status).toBe('EN_CURSO');
    expect(detail.openSprint?.stages).toHaveLength(4);
  });

  it('solo hay un Sprint abierto por proyecto (409)', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    expect((await ana.client.post(`/projects/${p.id}/sprints`)).statusCode).toBe(201);
    const second = await ana.client.post(`/projects/${p.id}/sprints`);
    expect(second.statusCode).toBe(409);
  });

  it('dos creaciones simultáneas producen un solo Sprint abierto', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const [a, b] = await Promise.all([
      ana.client.post(`/projects/${p.id}/sprints`),
      ana.client.post(`/projects/${p.id}/sprints`),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(await getTestDb().sprint.count({ where: { projectId: p.id, status: 'OPEN' } })).toBe(1);
  });

  it('el índice único parcial impide dos Sprints abiertos aunque se salte la aplicación', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    await ana.client.post(`/projects/${p.id}/sprints`);
    await expect(getTestDb().sprint.create({ data: { projectId: p.id, number: 99 } })).rejects.toThrow();
  });

  it('un Participante no puede crear Sprints (403)', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const p = await createProject(ana);
    await addMember(ana, p.id, beto, 'PARTICIPANT');
    expect((await beto.client.post(`/projects/${p.id}/sprints`)).statusCode).toBe(403);
  });

  it('registrar evidencia mueve la etapa a IN_PROGRESS y la lista devuelve autor y fecha', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const sprint = (await ana.client.post(`/projects/${p.id}/sprints`)).json() as { id: string };
    const url = `/projects/${p.id}/sprints/${sprint.id}/stages/PLANNING/evidence`;
    const res = await ana.client.post(url, { content: 'Acta de planificación: https://ejemplo.test/acta' });
    expect(res.statusCode).toBe(201);
    expect(res.json().authorPseudonym).toBe((await ana.client.get('/auth/me')).json().pseudonym);
    const list = (await ana.client.get(url)).json() as { content: string }[];
    expect(list).toHaveLength(1);
    const detail = (await ana.client.get(`/projects/${p.id}/sprints/${sprint.id}`)).json() as { stages: Stage[] };
    const planning = detail.stages.find((s) => s.type === 'PLANNING')!;
    expect(planning.status).toBe('IN_PROGRESS');
    expect(planning.startedAt).toBe(t.clock.now().toISOString());
  });

  it.each([
    ['vacía', ''],
    ['de solo espacios', '   '],
    ['de 2001 caracteres', 'x'.repeat(2001)],
  ])('rechaza evidencia %s con 422', async (_caso, content) => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const sprint = (await ana.client.post(`/projects/${p.id}/sprints`)).json() as { id: string };
    const res = await ana.client.post(`/projects/${p.id}/sprints/${sprint.id}/stages/PLANNING/evidence`, { content });
    expect(res.statusCode).toBe(422);
  });

  it('un tipo de etapa inexistente devuelve 404', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const sprint = (await ana.client.post(`/projects/${p.id}/sprints`)).json() as { id: string };
    const res = await ana.client.get(`/projects/${p.id}/sprints/${sprint.id}/stages/INVENTADA/evidence`);
    expect(res.statusCode).toBe(404);
  });

  it('el historial registra la creación del proyecto, del Sprint y de la evidencia', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const sprint = (await ana.client.post(`/projects/${p.id}/sprints`)).json() as { id: string };
    await ana.client.post(`/projects/${p.id}/sprints/${sprint.id}/stages/PLANNING/evidence`, { content: 'algo' });
    const activity = (await ana.client.get(`/projects/${p.id}/activity`)).json() as { action: string; occurredAt: string }[];
    expect(activity.map((a) => a.action)).toEqual(['evidence.added', 'sprint.created', 'project.created']);
  });
});
