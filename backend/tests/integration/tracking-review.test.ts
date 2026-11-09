import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, getSprint, type Scenario } from '../helpers/scenario.js';

const reviewBuena = {
  results: 'Se completaron 3 de las 4 historias seleccionadas.',
  increment: 'El formulario de asistencia ya registra la fecha y la hora.',
  feedback: 'El profesor sugirió mostrar un resumen semanal de ausencias.',
  goalAssessment: 'PARTIAL',
  goalAssessmentNote: 'Se logró el registro pero faltó el panel de resumen.',
};

interface Entry {
  id: string;
  kind: string;
  content: string;
  resolvedAt: string | null;
  authorPseudonym: string;
  createdAt: string;
}
interface Review {
  version: number;
  gateState: string;
  results: string;
  goalAssessment: string | null;
}
interface Run {
  id: string;
  status: string;
  results: { criterionId: string; outcome: string; origin: string; explanation: string }[];
}

describe('seguimiento del Sprint y Sprint Review (T128, FR-038, FR-039)', () => {
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

  const tracking = `/tracking`;
  const entradas = async () => (await s.ana.client.get(`${s.base}${tracking}`)).json() as Entry[];
  const registrar = (body: object, user = s.ana) => user.client.post(`${s.base}${tracking}`, body);
  const stage = async (type: string) => (await getSprint(s)).stages.find((x) => x.type === type)!;
  const validarPlanificacion = async () => {
    await fillPlan(s);
    await evaluatePlan(s);
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
  };

  describe('seguimiento (avances, impedimentos, observaciones y Daily Scrum)', () => {
    it('exige la planificación validada (409 STAGE_ORDER) antes de registrar', async () => {
      const res = await registrar({ kind: 'PROGRESS', content: 'Avance temprano' });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('STAGE_ORDER');
    });

    it('registra cada tipo de entrada con autor (seudónimo) y fecha del servidor', async () => {
      await validarPlanificacion();
      for (const kind of ['PROGRESS', 'IMPEDIMENT', 'OBSERVATION', 'DAILY_NOTE']) {
        const res = await registrar({ kind, content: `Entrada de tipo ${kind}` });
        expect(res.statusCode, res.body).toBe(201);
        expect(res.json()).toMatchObject({ kind, content: `Entrada de tipo ${kind}`, resolvedAt: null, authorPseudonym: s.ana.pseudonym, createdAt: t.clock.now().toISOString() });
      }
      expect(await entradas()).toHaveLength(4);
    });

    it('la lista se devuelve de la más reciente a la más antigua', async () => {
      await validarPlanificacion();
      await registrar({ kind: 'PROGRESS', content: 'Primera' });
      t.clock.advance(1000);
      await registrar({ kind: 'PROGRESS', content: 'Segunda' });
      expect((await entradas()).map((e) => e.content)).toEqual(['Segunda', 'Primera']);
    });

    it('el primer registro mueve la etapa de seguimiento a IN_PROGRESS', async () => {
      await validarPlanificacion();
      expect((await stage('TRACKING')).status).toBe('PENDING');
      await registrar({ kind: 'DAILY_NOTE', content: 'Daily del lunes' });
      expect((await stage('TRACKING')).status).toBe('IN_PROGRESS');
    });

    it.each([
      ['contenido vacío', { kind: 'PROGRESS', content: '' }],
      ['contenido de solo espacios', { kind: 'PROGRESS', content: '   ' }],
      ['contenido de 2001 caracteres', { kind: 'PROGRESS', content: 'x'.repeat(2001) }],
      ['tipo desconocido', { kind: 'RIESGO', content: 'algo' }],
      ['sin tipo', { content: 'algo' }],
    ])('rechaza %s con 422', async (_caso, body) => {
      await validarPlanificacion();
      expect((await registrar(body)).statusCode).toBe(422);
    });

    it('acepta un contenido de exactamente 2000 caracteres', async () => {
      await validarPlanificacion();
      expect((await registrar({ kind: 'OBSERVATION', content: 'x'.repeat(2000) })).statusCode).toBe(201);
    });

    it('un impedimento se puede marcar como resuelto con la fecha del servidor', async () => {
      await validarPlanificacion();
      const imp = (await registrar({ kind: 'IMPEDIMENT', content: 'No tenemos acceso al servidor' })).json() as Entry;
      t.clock.advance(5000);
      const res = await s.ana.client.post(`${s.base}${tracking}/${imp.id}/resolve`);
      expect(res.statusCode).toBe(200);
      expect(res.json().resolvedAt).toBe(t.clock.now().toISOString());
    });

    it('solo los impedimentos se resuelven (409) y no dos veces (409)', async () => {
      await validarPlanificacion();
      const avance = (await registrar({ kind: 'PROGRESS', content: 'Avance normal' })).json() as Entry;
      expect((await s.ana.client.post(`${s.base}${tracking}/${avance.id}/resolve`)).statusCode).toBe(409);
      const imp = (await registrar({ kind: 'IMPEDIMENT', content: 'Un impedimento' })).json() as Entry;
      await s.ana.client.post(`${s.base}${tracking}/${imp.id}/resolve`);
      expect((await s.ana.client.post(`${s.base}${tracking}/${imp.id}/resolve`)).statusCode).toBe(409);
    });

    it('el CHECK de la base impide una fecha de resolución en entradas que no son impedimentos', async () => {
      await validarPlanificacion();
      const avance = (await registrar({ kind: 'PROGRESS', content: 'Avance normal' })).json() as Entry;
      await expect(getTestDb().trackingEntry.update({ where: { id: avance.id }, data: { resolvedAt: new Date() } })).rejects.toThrow();
    });

    it('cualquier miembro registra; un ajeno no accede (404); una entrada ajena no se resuelve (404)', async () => {
      await validarPlanificacion();
      const beto = await createUser(t.app, 'beto');
      await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
      const imp = (await registrar({ kind: 'IMPEDIMENT', content: 'Impedimento de Beto' }, beto)).json() as Entry;
      expect(imp.authorPseudonym).toBe(beto.pseudonym);
      const intruso = await createUser(t.app, 'intruso');
      expect((await intruso.client.get(`${s.base}${tracking}`)).statusCode).toBe(404);
      const otro = await createUser(t.app, 'otro');
      const po = await createProject(otro);
      const so = (await otro.client.post(`/projects/${po.id}/sprints`)).json() as { id: string };
      expect((await otro.client.post(`/projects/${po.id}/sprints/${so.id}/tracking/${imp.id}/resolve`)).statusCode).toBe(404);
    });

    it('se puede actualizar el plan de trabajo durante el seguimiento', async () => {
      await validarPlanificacion();
      const sprint = await getSprint(s);
      const res = await s.ana.client.patch(s.base, { workPlan: `${sprint.workPlan} Añadimos pruebas de HU-1.`, expectedVersion: sprint.version });
      expect(res.statusCode).toBe(200);
      expect(res.json().workPlan).toContain('Añadimos pruebas');
    });

    it('el seguimiento se cierra sin compuerta y después un Sprint cerrado ya no admite entradas', async () => {
      await validarPlanificacion();
      await registrar({ kind: 'PROGRESS', content: 'Algo de avance' });
      const cierre = await completeStage(s, 'TRACKING');
      expect(cierre.statusCode).toBe(200);
      expect(cierre.json().status).toBe('VALIDATED');
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
      expect((await registrar({ kind: 'PROGRESS', content: 'Tarde' })).statusCode).toBe(409);
    });

    it('registrar de nuevo tras cerrar el seguimiento lo reabre (IN_PROGRESS)', async () => {
      await validarPlanificacion();
      await registrar({ kind: 'PROGRESS', content: 'Avance' });
      await completeStage(s, 'TRACKING');
      await registrar({ kind: 'OBSERVATION', content: 'Una observación posterior' });
      const etapa = await stage('TRACKING');
      expect(etapa.status).toBe('IN_PROGRESS');
      expect(etapa.completedAt).toBeNull();
    });
  });

  describe('Sprint Review', () => {
    const url = () => `${s.base}/review`;
    const evaluarReview = () => s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-REVIEW', targetType: 'SPRINT_REVIEW', targetId: s.sprintId });

    it('una Review nueva está vacía, en versión 1 y sin evaluar', async () => {
      const review = (await s.ana.client.get(url())).json() as Review;
      expect(review).toMatchObject({ version: 1, gateState: 'NO_EVALUADA', results: '', goalAssessment: null });
    });

    it('se guarda con la versión vigente (sin exigir la planificación validada)', async () => {
      const res = await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ ...reviewBuena, version: 2 });
      expect((await stage('REVIEW')).status).toBe('IN_PROGRESS');
    });

    it('versión desactualizada: 409 con el estado actual; dos PUT simultáneos: uno gana', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 });
      const stale = await s.ana.client.put(url(), { ...reviewBuena, results: 'Tarde', expectedVersion: 1 });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().code).toBe('VERSION_CONFLICT');
      expect(stale.json().current.results).toBe(reviewBuena.results);

      const [a, b] = await Promise.all([
        s.ana.client.put(url(), { ...reviewBuena, results: 'A', expectedVersion: 2 }),
        s.ana.client.put(url(), { ...reviewBuena, results: 'B', expectedVersion: 2 }),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    });

    it.each([
      ['resultados de 5001 caracteres', { results: 'x'.repeat(5001) }],
      ['incremento de 5001 caracteres', { increment: 'x'.repeat(5001) }],
      ['retroalimentación de 5001 caracteres', { feedback: 'x'.repeat(5001) }],
      ['nota de valoración de 2001 caracteres', { goalAssessmentNote: 'x'.repeat(2001) }],
      ['valoración desconocida', { goalAssessment: 'QUIZAS' }],
    ])('rechaza %s con 422', async (_caso, body) => {
      expect((await s.ana.client.put(url(), { ...reviewBuena, ...body, expectedVersion: 1 })).statusCode).toBe(422);
    });

    it('acepta la valoración nula y los límites exactos', async () => {
      const res = await s.ana.client.put(url(), { results: 'x'.repeat(5000), increment: '', feedback: '', goalAssessment: null, goalAssessmentNote: 'n'.repeat(2000), expectedVersion: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.json().goalAssessment).toBeNull();
    });

    it('evaluar una Review vacía: FAILED con cada criterio explicado y su origen', async () => {
      const run = (await evaluarReview()).json() as Run;
      expect(run.status).toBe('FAILED');
      expect(run.results.map((r) => r.criterionId)).toEqual(['REV-01', 'REV-02', 'REV-03', 'REV-04']);
      expect(run.results.every((r) => r.outcome === 'NOT_MET' && r.explanation !== '')).toBe(true);
      expect(new Set(run.results.map((r) => r.origin))).toEqual(new Set(['OFFICIAL', 'ADDITIONAL']));
    });

    it('sin relacionar el Sprint Goal se señala REV-03 con una sugerencia', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, goalAssessment: null, goalAssessmentNote: '', expectedVersion: 1 });
      const run = (await evaluarReview()).json() as Run;
      expect(run.results.find((r) => r.criterionId === 'REV-03')!.outcome).toBe('NOT_MET');
      expect(run.status).toBe('FAILED');
    });

    it('una Review completa se aprueba y su estado de compuerta es APROBADA hasta que cambie', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 });
      expect(((await evaluarReview()).json() as Run).status).toBe('PASSED');
      expect(((await s.ana.client.get(url())).json() as Review).gateState).toBe('APROBADA');
      const v = ((await s.ana.client.get(url())).json() as Review).version;
      await s.ana.client.put(url(), { ...reviewBuena, feedback: 'Más retroalimentación', expectedVersion: v });
      expect(((await s.ana.client.get(url())).json() as Review).gateState).toBe('DESACTUALIZADA');
    });

    it('la evaluación no bloquea: la Review se puede completar aunque falle', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, goalAssessment: null, expectedVersion: 1 });
      expect(((await evaluarReview()).json() as Run).status).toBe('FAILED');
      const res = await completeStage(s, 'REVIEW');
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('VALIDATED');
    });

    it('no admite excepciones (no bloquea el avance)', async () => {
      const run = (await evaluarReview()).json() as Run;
      const exc = await s.ana.client.post(`/projects/${s.projectId}/validations/${run.id}/exception`, { justification: 'No debería hacer falta una excepción.' });
      expect(exc.statusCode).toBe(409);
    });

    it('editar una Review ya cerrada la reabre (IN_PROGRESS) en lugar de dejarla bloqueada', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 });
      await completeStage(s, 'REVIEW');
      await s.ana.client.put(url(), { ...reviewBuena, results: 'Corregido después de cerrar', expectedVersion: 2 });
      const etapa = await stage('REVIEW');
      expect(etapa.status).toBe('IN_PROGRESS');
      expect(etapa.completedAt).toBeNull();
    });

    it('el detalle del Sprint muestra el estado de la compuerta de la Review', async () => {
      await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 });
      await evaluarReview();
      expect((await stage('REVIEW')).gateState).toBe('APROBADA');
    });

    it('un Sprint cerrado no admite cambios en la Review (409); un ajeno recibe 404; un objetivo de otro proyecto 404', async () => {
      const intruso = await createUser(t.app, 'intruso');
      expect((await intruso.client.get(url())).statusCode).toBe(404);
      const otro = await createScenario(t.app);
      const ajena = await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-REVIEW', targetType: 'SPRINT_REVIEW', targetId: otro.sprintId });
      expect(ajena.statusCode).toBe(404);
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
      expect((await s.ana.client.put(url(), { ...reviewBuena, expectedVersion: 1 })).statusCode).toBe(409);
    });
  });
});
