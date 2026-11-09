import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, getSprint, type Scenario } from '../helpers/scenario.js';

interface Run {
  id: string;
  status: string;
  aiStatus: string;
  attemptNo: number;
  results: { criterionId: string; outcome: string; origin: string }[];
}

const stage = async (s: Scenario, type: string) => (await getSprint(s)).stages.find((x) => x.type === type)!;

describe('compuerta de planificación y avance (T073, FR-012–FR-015, SC-003)', () => {
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

  it('un Sprint sin Sprint Goal: la compuerta falla y el avance queda bloqueado con criterios fallidos', async () => {
    const res = await evaluatePlan(s);
    expect(res.statusCode).toBe(201);
    const run = res.json() as Run;
    expect(run.status).toBe('FAILED');
    const fallidos = run.results.filter((r) => r.outcome === 'NOT_MET').map((r) => r.criterionId);
    expect(fallidos).toEqual(expect.arrayContaining(['PLAN-01', 'PLAN-02', 'PLAN-03']));
    expect(run.aiStatus).toBe('NOT_REQUESTED'); // la compuerta se evalúa sin IA

    const avance = await completeStage(s, 'PLANNING');
    expect(avance.statusCode).toBe(409);
    expect(avance.json().code).toBe('GATE_NOT_PASSED');
  });

  it('completar sin haber evaluado nunca: 409 GATE_NOT_PASSED', async () => {
    await fillPlan(s);
    const res = await completeStage(s, 'PLANNING');
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('GATE_NOT_PASSED');
  });

  it('evaluar con fallo mueve la etapa a NEEDS_CORRECTION; corregir y reevaluar la aprueba y permite avanzar', async () => {
    await s.ana.client.patch(s.base, { sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel', expectedVersion: 1 });
    const primero = (await evaluatePlan(s)).json() as Run;
    expect(primero.status).toBe('FAILED');
    expect((await stage(s, 'PLANNING')).status).toBe('NEEDS_CORRECTION');

    await fillPlan(s);
    expect((await stage(s, 'PLANNING')).status).toBe('IN_PROGRESS');
    const segundo = (await evaluatePlan(s)).json() as Run;
    expect([primero.attemptNo, segundo.attemptNo]).toEqual([1, 2]);
    expect(segundo.status).toBe('PASSED');
    expect((await stage(s, 'PLANNING')).gateState).toBe('APROBADA');

    const avance = await completeStage(s, 'PLANNING');
    expect(avance.statusCode).toBe(200);
    expect(avance.json()).toMatchObject({ type: 'PLANNING', status: 'VALIDATED' });
    expect(avance.json().completedAt).toBe(t.clock.now().toISOString());
  });

  it('la evaluación registra fecha, estado, intento y resultado por criterio con su origen', async () => {
    await fillPlan(s);
    const run = (await evaluatePlan(s)).json() as Run;
    expect(run.results).toHaveLength(7);
    expect(new Set(run.results.map((r) => r.origin))).toEqual(new Set(['OFFICIAL', 'ADDITIONAL']));
    const guardado = await getTestDb().validationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(guardado).toMatchObject({ gateId: 'GATE-PLAN', targetType: 'SPRINT', attemptNo: 1, status: 'PASSED' });
    expect(guardado.finishedAt.toISOString()).toBe(t.clock.now().toISOString());
  });

  it('PLAN-07: una historia sin evaluación aprobada impide aprobar la compuerta', async () => {
    const sinAprobar = await createScenario(t.app, { approveStory: false });
    await fillPlan(sinAprobar);
    const run = (await evaluatePlan(sinAprobar)).json() as Run;
    expect(run.status).toBe('FAILED');
    expect(run.results.find((r) => r.criterionId === 'PLAN-07')!.outcome).toBe('NOT_MET');
  });

  it('una evaluación desactualizada (el Sprint cambió después) no habilita el avance', async () => {
    await fillPlan(s);
    await evaluatePlan(s);
    const sprint = await getSprint(s);
    await s.ana.client.patch(s.base, { workPlan: `${sprint.workPlan} Además revisaremos HU-1 con el equipo.`, expectedVersion: sprint.version });
    const avance = await completeStage(s, 'PLANNING');
    expect(avance.statusCode).toBe(409);
    expect(avance.json().code).toBe('GATE_NOT_PASSED');
  });

  it('una evaluación con status ERROR nunca habilita el avance', async () => {
    await fillPlan(s);
    const sprint = await getSprint(s);
    await getTestDb().validationRun.create({
      data: {
        projectId: s.projectId,
        gateId: 'GATE-PLAN',
        targetType: 'SPRINT',
        targetId: s.sprintId,
        targetVersion: sprint.version,
        targetSnapshot: {},
        attemptNo: 1,
        status: 'ERROR',
        catalogVersion: '1.0.0',
        aiStatus: 'NOT_REQUESTED',
        requestedBy: (await getTestDb().user.findFirstOrThrow()).id,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    const avance = await completeStage(s, 'PLANNING');
    expect(avance.statusCode).toBe(409);
    expect(avance.json().code).toBe('GATE_NOT_PASSED');
  });

  describe('orden de etapas: el seguimiento exige la planificación validada (STAGE_ORDER)', () => {
    it('completar el seguimiento antes: 409 STAGE_ORDER', async () => {
      const res = await completeStage(s, 'TRACKING');
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('STAGE_ORDER');
    });

    it('registrar evidencia en el seguimiento antes de validar la planificación: 409 STAGE_ORDER', async () => {
      const res = await s.ana.client.post(`${s.base}/stages/TRACKING/evidence`, { content: 'Avance temprano' });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('STAGE_ORDER');
    });

    it('tras validar la planificación, el seguimiento se puede trabajar y cerrar (sin compuerta)', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
      expect((await s.ana.client.post(`${s.base}/stages/TRACKING/evidence`, { content: 'Primer avance' })).statusCode).toBe(201);
      expect((await stage(s, 'TRACKING')).status).toBe('IN_PROGRESS');
      const cierre = await completeStage(s, 'TRACKING');
      expect(cierre.statusCode).toBe(200);
      expect(cierre.json().status).toBe('VALIDATED');
    });

    it('la revisión no está bloqueada por la planificación (Scrum no impone la secuencia)', async () => {
      const res = await s.ana.client.post(`${s.base}/stages/REVIEW/evidence`, { content: 'Notas de revisión' });
      expect(res.statusCode).toBe(201);
    });
  });

  it('completar una etapa ya validada devuelve 409', async () => {
    await fillPlan(s);
    await evaluatePlan(s);
    await completeStage(s, 'PLANNING');
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(409);
  });

  it('un tipo de etapa inválido devuelve 404', async () => {
    const res = await s.ana.client.post(`${s.base}/stages/INVENTADA/complete`);
    expect(res.statusCode).toBe(404);
  });

  it('completar queda en el historial con la duración derivable (inicio y fin del servidor)', async () => {
    await fillPlan(s);
    t.clock.advance(60_000);
    await evaluatePlan(s);
    t.clock.advance(60_000);
    await completeStage(s, 'PLANNING');
    const planning = await getTestDb().sprintStage.findFirstOrThrow({ where: { sprintId: s.sprintId, type: 'PLANNING' } });
    expect(planning.completedAt!.getTime() - planning.startedAt!.getTime()).toBe(120_000);
    const acciones = ((await s.ana.client.get(`/projects/${s.projectId}/activity`)).json() as { action: string }[]).map((a) => a.action);
    expect(acciones).toContain('stage.completed');
  });
});
