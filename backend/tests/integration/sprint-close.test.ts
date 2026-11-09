import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluateRetro, fillRetro, getSprint, retroBuena, retroUrl, type Scenario } from '../helpers/scenario.js';

interface Run {
  id: string;
  status: string;
}

const JUSTIFICACION = 'El equipo acordó con el docente cerrar el Sprint con acciones provisionales.';
const estadoDelSprint = async (s: Scenario) => ((await getSprint(s)) as unknown as { status: string }).status;

describe('cierre del Sprint con la retrospectiva (T111, FR-011, FR-013, FR-016)', () => {
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

  const crearSiguiente = (user = s.ana) => user.client.post(`/projects/${s.projectId}/sprints`);

  it('completar la retrospectiva sin evaluación aprobada: 409 GATE_NOT_PASSED y el Sprint sigue abierto', async () => {
    const sin = await completeStage(s, 'RETROSPECTIVE');
    expect(sin.statusCode).toBe(409);
    expect(sin.json().code).toBe('GATE_NOT_PASSED');

    await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
    expect(((await evaluateRetro(s)).json() as Run).status).toBe('FAILED');
    const fallida = await completeStage(s, 'RETROSPECTIVE');
    expect(fallida.statusCode).toBe(409);
    expect(await estadoDelSprint(s)).toBe('OPEN');
  });

  it('con la compuerta aprobada la etapa queda VALIDATED y el Sprint se cierra en la misma operación', async () => {
    await fillRetro(s);
    expect(((await evaluateRetro(s)).json() as Run).status).toBe('PASSED');
    const res = await completeStage(s, 'RETROSPECTIVE');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: 'RETROSPECTIVE', status: 'VALIDATED' });

    expect(await estadoDelSprint(s)).toBe('CLOSED');
    const fila = await getTestDb().sprint.findUniqueOrThrow({ where: { id: s.sprintId } });
    expect(fila.closedAt!.toISOString()).toBe(t.clock.now().toISOString());
    const acciones = ((await s.ana.client.get(`/projects/${s.projectId}/activity`)).json() as { action: string }[]).map((a) => a.action);
    expect(acciones).toEqual(expect.arrayContaining(['stage.completed', 'sprint.closed']));
    const detalle = (await s.ana.client.get(`/projects/${s.projectId}`)).json() as { status: string; openSprint: unknown };
    expect(detalle).toMatchObject({ status: 'CERRADO', openSprint: null });
  });

  it('una evaluación desactualizada (la retrospectiva cambió después) no permite cerrar', async () => {
    await fillRetro(s);
    await evaluateRetro(s);
    await s.ana.client.post(`${retroUrl(s)}/actions`, { description: 'Una acción añadida tras evaluar la retrospectiva' });
    const res = await completeStage(s, 'RETROSPECTIVE');
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('GATE_NOT_PASSED');
  });

  it('con una excepción del Facilitador se puede cerrar aunque la compuerta falle', async () => {
    await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
    const run = (await evaluateRetro(s)).json() as Run;
    expect(run.status).toBe('FAILED');
    const exc = await s.ana.client.post(`/projects/${s.projectId}/validations/${run.id}/exception`, { justification: JUSTIFICACION });
    expect(exc.statusCode).toBe(201);
    expect((await getSprint(s)).stages.find((x) => x.type === 'RETROSPECTIVE')!.gateState).toBe('APROBADA_CON_EXCEPCION');
    expect((await completeStage(s, 'RETROSPECTIVE')).statusCode).toBe(200);
    expect(await estadoDelSprint(s)).toBe('CLOSED');
  });

  it('un Participante no puede conceder la excepción de la retrospectiva (403)', async () => {
    const beto = await createUser(t.app, 'beto');
    await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
    await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
    const run = (await evaluateRetro(s)).json() as Run;
    const exc = await beto.client.post(`/projects/${s.projectId}/validations/${run.id}/exception`, { justification: JUSTIFICACION });
    expect(exc.statusCode).toBe(403);
  });

  describe('siguiente Sprint', () => {
    it('no se puede crear mientras haya uno abierto (409)', async () => {
      expect((await crearSiguiente()).statusCode).toBe(409);
    });

    it('tras cerrar, solo el Facilitador crea el siguiente, con número consecutivo y sus 4 etapas en PENDING', async () => {
      await fillRetro(s);
      await evaluateRetro(s);
      await completeStage(s, 'RETROSPECTIVE');
      const beto = await createUser(t.app, 'beto');
      await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
      expect((await crearSiguiente(beto)).statusCode).toBe(403);

      const res = await crearSiguiente();
      expect(res.statusCode).toBe(201);
      const nuevo = res.json() as { number: number; status: string; stages: { status: string }[] };
      expect(nuevo).toMatchObject({ number: 2, status: 'OPEN' });
      expect(nuevo.stages.every((x) => x.status === 'PENDING')).toBe(true);
      expect(await getTestDb().sprint.count({ where: { projectId: s.projectId, status: 'OPEN' } })).toBe(1);
      const lista = (await s.ana.client.get(`/projects/${s.projectId}/sprints`)).json() as { number: number; status: string }[];
      expect(lista.map((x) => `${x.number}:${x.status}`)).toEqual(['2:OPEN', '1:CLOSED']);
    });

    it('dos creaciones simultáneas tras el cierre producen un solo Sprint abierto', async () => {
      await fillRetro(s);
      await evaluateRetro(s);
      await completeStage(s, 'RETROSPECTIVE');
      const [a, b] = await Promise.all([crearSiguiente(), crearSiguiente()]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    });
  });

  describe('un Sprint cerrado ya no admite cambios', () => {
    beforeEach(async () => {
      await fillRetro(s);
      await evaluateRetro(s);
      await completeStage(s, 'RETROSPECTIVE');
    });

    it('no admite evidencia, edición del plan ni nuevas evaluaciones (409)', async () => {
      expect((await s.ana.client.post(`${s.base}/stages/REVIEW/evidence`, { content: 'tarde' })).statusCode).toBe(409);
      expect((await s.ana.client.patch(s.base, { sprintGoal: 'tarde', expectedVersion: 1 })).statusCode).toBe(409);
      expect((await evaluateRetro(s)).statusCode).toBe(409);
      expect((await completeStage(s, 'REVIEW')).statusCode).toBe(409);
    });

    it('el historial de intentos y resultados se conserva', async () => {
      const lista = (await s.ana.client.get(`/projects/${s.projectId}/validations?targetType=RETROSPECTIVE&targetId=${s.sprintId}`)).json() as Run[];
      expect(lista).toHaveLength(1);
      expect(lista[0]!.status).toBe('PASSED');
    });
  });
});
