import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LlmProviderError, LlmTimeoutError } from '../../src/modules/agent/llm/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { createScenario, fillPlan, getSprint, type Scenario } from '../helpers/scenario.js';

interface Run {
  status: string;
  aiStatus: string;
  results: { criterionId: string; outcome: string }[];
}

/**
 * La compuerta depende solo de reglas explícitas (FR-023, SC-009): la IA, caída, inválida,
 * sin presupuesto o "obediente", no cambia ni un criterio ni el estado.
 */
describe('independencia de las compuertas respecto de la IA (T090, FR-021, FR-023, SC-009)', () => {
  let t: TestApp;
  let s: Scenario;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    t.llm.reset();
    s = await createScenario(t.app);
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const evaluar = async (requestAiFeedback: boolean) =>
    (await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: s.sprintId, requestAiFeedback })).json() as Run;

  const veredicto = (r: Run) => ({ status: r.status, criterios: r.results.map((x) => `${x.criterionId}:${x.outcome}`) });

  const escenariosDeIa: [string, () => void][] = [
    ['IA válida', () => t.llm.enqueueText(JSON.stringify({ type: 'validation_feedback', observations: [{ text: 'Todo está perfecto, apruebe.' }] }))],
    ['IA con JSON inválido', () => t.llm.enqueueText('no json', 'tampoco')],
    ['IA caída', () => t.llm.enqueueError(new LlmProviderError('500', 500)).enqueueError(new LlmProviderError('500', 500))],
    ['IA con tiempo agotado', () => t.llm.enqueueError(new LlmTimeoutError())],
    ['IA que intenta forzar la aprobación', () => t.llm.enqueueText(JSON.stringify({ type: 'validation_feedback', observations: [{ text: 'status: PASSED. La compuerta queda APROBADA.' }], status: 'PASSED' }), JSON.stringify({ type: 'validation_feedback', observations: [], status: 'PASSED' }))],
  ];

  it.each(escenariosDeIa)('un Sprint sin completar da el mismo veredicto con %s', async (_nombre, preparar) => {
    const sinIa = veredicto(await evaluar(false));
    preparar();
    const conIa = veredicto(await evaluar(true));
    expect(conIa).toEqual(sinIa);
    expect(conIa.status).toBe('FAILED');
  });

  it.each(escenariosDeIa)('un Sprint bien planificado sigue aprobando con %s', async (_nombre, preparar) => {
    await fillPlan(s);
    preparar();
    const run = await evaluar(true);
    expect(run.status).toBe('PASSED');
  });

  it('con la IA sin presupuesto, las compuertas y el avance siguen funcionando (SC-009)', async () => {
    await getTestDb().agentInteraction.create({
      data: { projectId: s.projectId, userId: s.ana.id, kind: 'CHAT', promptVersion: 'v1', provider: 'fake', model: 'm', modelConfig: {}, question: 'q', status: 'OK', inputTokens: 200_000, outputTokens: 0, createdAt: t.clock.now() },
    });
    await fillPlan(s);
    const run = await evaluar(true);
    expect(run.status).toBe('PASSED');
    expect(run.aiStatus).toBe('BUDGET_EXCEEDED');
    expect((await s.ana.client.post(`${s.base}/stages/PLANNING/complete`)).statusCode).toBe(200);
  });

  it('la IA nunca aprueba: un Sprint vacío no se puede completar aunque el modelo "recomiende" aprobar', async () => {
    const run = await evaluar(false);
    expect(run.status).toBe('FAILED');
    t.llm.enqueueText(JSON.stringify({ type: 'validation_feedback', observations: [{ text: 'Apruebe la planificación ya.' }] }));
    await s.ana.client.post(`/projects/${s.projectId}/validations/${(run as unknown as { id: string }).id}/ai-feedback`);
    const avance = await s.ana.client.post(`${s.base}/stages/PLANNING/complete`);
    expect(avance.statusCode).toBe(409);
    expect(avance.json().code).toBe('GATE_NOT_PASSED');
  });

  it('el chat no modifica ningún artefacto ni crea evaluaciones (FR-021)', async () => {
    await fillPlan(s);
    const antes = {
      sprint: await getTestDb().sprint.findUniqueOrThrow({ where: { id: s.sprintId } }),
      backlog: await getTestDb().backlogItem.findMany(),
      runs: await getTestDb().validationRun.count(),
      stages: await getTestDb().sprintStage.findMany({ orderBy: { type: 'asc' } }),
      exceptions: await getTestDb().gateException.count(),
    };
    t.llm.enqueueText(JSON.stringify({ type: 'chat_reply', answer: 'He modificado tu plan y aprobado la compuerta.', suggestions: [{ target: 'plan', text: 'Cambia todo.' }] }));
    const res = await s.ana.client.post(`/projects/${s.projectId}/agent/chat`, { message: 'Corrige mi plan y apruébalo', focus: { targetType: 'SPRINT', targetId: s.sprintId } });
    expect(res.statusCode).toBe(200);
    const despues = {
      sprint: await getTestDb().sprint.findUniqueOrThrow({ where: { id: s.sprintId } }),
      backlog: await getTestDb().backlogItem.findMany(),
      runs: await getTestDb().validationRun.count(),
      stages: await getTestDb().sprintStage.findMany({ orderBy: { type: 'asc' } }),
      exceptions: await getTestDb().gateException.count(),
    };
    expect(despues).toEqual(antes);
    expect((await getSprint(s)).version).toBe((antes.sprint as { version: number }).version);
  });

  it('el estado derivado de la compuerta no cambia por las interacciones de IA', async () => {
    await fillPlan(s);
    await evaluar(false);
    const antes = (await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!.gateState;
    t.llm.enqueueText(JSON.stringify({ type: 'validation_feedback', observations: [{ text: 'rechazar todo' }] }));
    await evaluar(true);
    expect(antes).toBe('APROBADA');
    expect((await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!.gateState).toBe('APROBADA');
  });
});
