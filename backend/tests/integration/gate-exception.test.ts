import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, getSprint, historiaBuena, type Scenario } from '../helpers/scenario.js';

interface Run {
  id: string;
  status: string;
  attemptNo: number;
  exception: { authorizedByPseudonym: string; justification: string } | null;
}

const JUSTIFICACION = 'El equipo acordó con el docente avanzar con este objetivo provisional.';

describe('excepciones manuales de compuerta (T074, FR-016)', () => {
  let t: TestApp;
  let s: Scenario;
  let fallida: Run;

  const conceder = (runId: string, body: unknown = { justification: JUSTIFICACION }, user = s.ana) =>
    user.client.post(`/projects/${s.projectId}/validations/${runId}/exception`, body);

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    s = await createScenario(t.app);
    // Sprint con objetivo pero sin plan de trabajo: la compuerta falla.
    await s.ana.client.patch(s.base, { sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel', expectedVersion: 1 });
    fallida = (await evaluatePlan(s)).json() as Run;
    expect(fallida.status).toBe('FAILED');
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('el Facilitador concede una excepción justificada y el avance se habilita y queda registrado', async () => {
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(409);
    const res = await conceder(fallida.id);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ justification: JUSTIFICACION });
    expect(res.json().authorizedByPseudonym).toMatch(/^P-/);
    expect(res.json().createdAt).toBe(t.clock.now().toISOString());

    expect((await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!.gateState).toBe('APROBADA_CON_EXCEPCION');
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);

    const detalle = (await s.ana.client.get(`/projects/${s.projectId}/validations/${fallida.id}`)).json() as Run;
    expect(detalle.exception?.justification).toBe(JUSTIFICACION);
    const acciones = ((await s.ana.client.get(`/projects/${s.projectId}/activity`)).json() as { action: string }[]).map((a) => a.action);
    expect(acciones).toContain('gate.exception_granted');
  });

  it('un Participante no puede conceder excepciones (403)', async () => {
    const beto = await createUser(t.app, 'beto');
    await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'PARTICIPANT' });
    expect((await conceder(fallida.id, { justification: JUSTIFICACION }, beto)).statusCode).toBe(403);
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(409);
  });

  it.each([
    ['vacía', ''],
    ['de solo espacios', '            '],
    ['de 9 caracteres', 'muy corta'],
    ['de 9 caracteres con espacios alrededor', '   corta123   '],
    ['de 1001 caracteres', 'x'.repeat(1001)],
  ])('rechaza una justificación %s con 422', async (_caso, justification) => {
    const res = await conceder(fallida.id, { justification });
    expect(res.statusCode).toBe(422);
  });

  it('acepta una justificación de exactamente 10 caracteres', async () => {
    expect((await conceder(fallida.id, { justification: 'abcdefghij' })).statusCode).toBe(201);
  });

  it('sin justificación en el cuerpo: 422', async () => {
    expect((await conceder(fallida.id, {})).statusCode).toBe(422);
  });

  it('solo se concede sobre una evaluación FAILED (409 si fue PASSED)', async () => {
    await fillPlan(s);
    const aprobada = (await evaluatePlan(s)).json() as Run;
    expect(aprobada.status).toBe('PASSED');
    expect((await conceder(aprobada.id)).statusCode).toBe(409);
  });

  it('solo sobre la evaluación vigente: una desactualizada o no más reciente da 409', async () => {
    // Intento 1 (fallido) ya no es el último tras un segundo intento.
    const segundo = (await evaluatePlan(s)).json() as Run;
    expect((await conceder(fallida.id)).statusCode).toBe(409);
    // El segundo es el vigente: se puede.
    expect((await conceder(segundo.id)).statusCode).toBe(201);
    // Si el Sprint cambia, la evaluación deja de ser vigente y la excepción pierde efecto.
    const sprint = await getSprint(s);
    await s.ana.client.patch(s.base, { workPlan: 'Plan nuevo', expectedVersion: sprint.version });
    expect((await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!.gateState).toBe('DESACTUALIZADA');
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(409);
  });

  it('una evaluación desactualizada no admite excepción (409)', async () => {
    const sprint = await getSprint(s);
    await s.ana.client.patch(s.base, { workPlan: 'Cambio posterior', expectedVersion: sprint.version });
    expect((await conceder(fallida.id)).statusCode).toBe(409);
  });

  it('solo una excepción por evaluación (409 la segunda)', async () => {
    expect((await conceder(fallida.id)).statusCode).toBe(201);
    expect((await conceder(fallida.id)).statusCode).toBe(409);
  });

  it('las compuertas no bloqueantes (GATE-STORY) no necesitan ni admiten excepción', async () => {
    const mala = (await s.ana.client.post(`/projects/${s.projectId}/backlog`, { ...historiaBuena, title: 'Mala', iWant: 'algo rápido', acceptanceCriteria: [], priority: 2 })).json() as { id: string };
    const run = (await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: mala.id })).json() as Run;
    expect(run.status).toBe('FAILED');
    expect((await conceder(run.id)).statusCode).toBe(409);
  });

  it('una evaluación de otro proyecto o inexistente: 404', async () => {
    const beto = await createUser(t.app, 'beto');
    const { createProject } = await import('../helpers/factories.js');
    const pb = await createProject(beto);
    expect((await beto.client.post(`/projects/${pb.id}/validations/${fallida.id}/exception`, { justification: JUSTIFICACION })).statusCode).toBe(404);
    expect((await conceder('00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  });

  it('las excepciones exigen sesión', async () => {
    const { TestClient } = await import('../helpers/client.js');
    const anon = new TestClient(t.app);
    const res = await anon.post(`/projects/${s.projectId}/validations/${fallida.id}/exception`, { justification: JUSTIFICACION });
    expect([401, 403]).toContain(res.statusCode);
  });
});
