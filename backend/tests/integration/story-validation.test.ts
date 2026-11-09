import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, type TestUser } from '../helpers/factories.js';

const ambigua = {
  kind: 'USER_STORY',
  title: 'Idea suelta',
  asA: 'usuario',
  iWant: 'algo rápido y fácil',
  soThat: 'todo sea mejor',
  acceptanceCriteria: [],
  priority: 1,
};
const buena = {
  kind: 'USER_STORY',
  title: 'Registrar asistencia',
  asA: 'Scrum Master',
  iWant: 'registrar la asistencia diaria del equipo en la reunión',
  soThat: 'puedo detectar ausencias recurrentes a tiempo',
  acceptanceCriteria: ['Se guarda la fecha y la hora del registro', 'Solo el Scrum Master puede modificar un registro guardado'],
  priority: 1,
};

interface Run {
  id: string;
  attemptNo: number;
  status: string;
  targetVersion: number;
  aiStatus: string;
  catalogVersion: string;
  results: { criterionId: string; origin: string; mandatory: boolean; outcome: string; source: string; explanation: string; recommendation: string }[];
  aiObservations: unknown[];
}

describe('evaluación de historias GATE-STORY (T055, FR-012, FR-014, FR-015, FR-017)', () => {
  let t: TestApp;
  let ana: TestUser;
  let projectId: string;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    ana = await createUser(t.app, 'ana');
    projectId = (await createProject(ana)).id;
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const crear = async (body: object) =>
    (await ana.client.post(`/projects/${projectId}/backlog`, body)).json() as { id: string; version: number };
  const evaluar = (targetId: string, extra: object = {}) =>
    ana.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId, ...extra });

  it('evalúa una historia ambigua: FAILED con criterios, origen, explicación y recomendación', async () => {
    const item = await crear(ambigua);
    const res = await evaluar(item.id);
    expect(res.statusCode).toBe(201);
    const run = res.json() as Run;
    expect(run).toMatchObject({ attemptNo: 1, status: 'FAILED', aiStatus: 'NOT_REQUESTED', targetVersion: 1, catalogVersion: '1.0.0' });
    expect(run.aiObservations).toEqual([]);
    const fallidos = run.results.filter((r) => r.outcome === 'NOT_MET');
    expect(fallidos.map((r) => r.criterionId)).toEqual(expect.arrayContaining(['STORY-04', 'STORY-05']));
    for (const r of fallidos) {
      expect(r.explanation).not.toBe('');
      expect(r.recommendation).not.toBe('');
    }
    expect(run.results.every((r) => r.source === 'RULE_CHECK')).toBe(true);
    expect(new Set(run.results.map((r) => r.origin))).toEqual(new Set(['OFFICIAL', 'ADDITIONAL']));
  });

  it('una historia bien formada pasa (PASSED)', async () => {
    const item = await crear(buena);
    const run = (await evaluar(item.id)).json() as Run;
    expect(run.status).toBe('PASSED');
  });

  it('reevaluar crea un nuevo intento y conserva los anteriores tras editar', async () => {
    const item = await crear(ambigua);
    const primero = (await evaluar(item.id)).json() as Run;
    await ana.client.patch(`/projects/${projectId}/backlog/${item.id}`, { ...buena, expectedVersion: item.version });
    const segundo = (await evaluar(item.id)).json() as Run;
    expect([primero.attemptNo, segundo.attemptNo]).toEqual([1, 2]);
    expect(primero.status).toBe('FAILED');
    expect(segundo.status).toBe('PASSED');
    expect(segundo.targetVersion).toBe(2);

    const historial = (await ana.client.get(`/projects/${projectId}/validations?targetType=BACKLOG_ITEM&targetId=${item.id}`)).json() as Run[];
    expect(historial.map((r) => r.attemptNo)).toEqual([2, 1]);
    // El primer intento conserva sus resultados originales (evidencia histórica).
    const detalle = (await ana.client.get(`/projects/${projectId}/validations/${primero.id}`)).json() as Run;
    expect(detalle.results.filter((r) => r.outcome === 'NOT_MET').length).toBeGreaterThan(0);
  });

  it('el estado de la compuerta en el backlog: NO_EVALUADA → NO_APROBADA → DESACTUALIZADA → APROBADA', async () => {
    const item = await crear(ambigua);
    const estado = async () => ((await ana.client.get(`/projects/${projectId}/backlog/${item.id}`)).json() as { gateState: string }).gateState;
    expect(await estado()).toBe('NO_EVALUADA');
    await evaluar(item.id);
    expect(await estado()).toBe('NO_APROBADA');
    await ana.client.patch(`/projects/${projectId}/backlog/${item.id}`, { ...buena, expectedVersion: 1 });
    expect(await estado()).toBe('DESACTUALIZADA');
    await evaluar(item.id);
    expect(await estado()).toBe('APROBADA');
  });

  it('diez evaluaciones simultáneas obtienen intentos distintos y consecutivos', async () => {
    const item = await crear(buena);
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => evaluar(item.id)));
    expect(respuestas.every((r) => r.statusCode === 201)).toBe(true);
    const intentos = respuestas.map((r) => (r.json() as Run).attemptNo).sort((a, b) => a - b);
    expect(intentos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('cualquier miembro puede evaluar (un Participante también)', async () => {
    const beto = await createUser(t.app, 'beto');
    await addMember(ana, projectId, beto, 'PARTICIPANT');
    const item = await crear(buena);
    const res = await beto.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: item.id });
    expect(res.statusCode).toBe(201);
  });

  it('el catálogo expone la versión y el origen oficial/adicional de cada criterio (FR-017)', async () => {
    const res = await ana.client.get('/criteria-catalog');
    expect(res.statusCode).toBe(200);
    const catalogo = res.json() as { catalogVersion: string; gates: { gateId: string; blocking: boolean; criteria: { id: string; origin: string; mandatory: boolean; title: string }[] }[] };
    expect(catalogo.catalogVersion).toBe('1.0.0');
    const gate = catalogo.gates.find((g) => g.gateId === 'GATE-STORY')!;
    expect(gate.blocking).toBe(false);
    expect(gate.criteria.map((c) => c.id)).toEqual(['STORY-01', 'STORY-02', 'STORY-03', 'STORY-04', 'STORY-05', 'STORY-06', 'STORY-07', 'STORY-08']);
    expect(gate.criteria.find((c) => c.id === 'STORY-01')!.origin).toBe('OFFICIAL');
    expect(gate.criteria.find((c) => c.id === 'STORY-05')!.origin).toBe('ADDITIONAL');
  });

  it('el catálogo exige sesión', async () => {
    const { TestClient } = await import('../helpers/client.js');
    expect((await new TestClient(t.app).get('/criteria-catalog')).statusCode).toBe(401);
  });

  it('compuerta desconocida o incompatible con el objetivo: 422', async () => {
    const item = await crear(buena);
    const desconocida = await ana.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-INVENTADA', targetType: 'BACKLOG_ITEM', targetId: item.id });
    expect(desconocida.statusCode).toBe(422);
    const incompatible = await ana.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'SPRINT', targetId: item.id });
    expect(incompatible.statusCode).toBe(422);
  });

  it('un objetivo inexistente o de otro proyecto responde 404', async () => {
    const beto = await createUser(t.app, 'beto');
    const pb = await createProject(beto);
    const ajeno = (await beto.client.post(`/projects/${pb.id}/backlog`, buena)).json() as { id: string };
    expect((await evaluar(randomUUID())).statusCode).toBe(404);
    expect((await evaluar(ajeno.id)).statusCode).toBe(404);
  });

  it('una evaluación de otro proyecto no se alcanza por su id (404)', async () => {
    const item = await crear(buena);
    const run = (await evaluar(item.id)).json() as Run;
    const beto = await createUser(t.app, 'beto');
    const pb = await createProject(beto);
    expect((await beto.client.get(`/projects/${pb.id}/validations/${run.id}`)).statusCode).toBe(404);
    expect((await beto.client.get(`/projects/${projectId}/validations/${run.id}`)).statusCode).toBe(404);
  });

  it('registra la actividad de evaluación (fecha, compuerta e intento) sin contenido', async () => {
    const item = await crear(buena);
    await evaluar(item.id);
    const act = (await ana.client.get(`/projects/${projectId}/activity`)).json() as { action: string }[];
    expect(act.map((a) => a.action)).toContain('gate.evaluated');
  });
});
