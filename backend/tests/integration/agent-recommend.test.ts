import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { createScenario, evaluatePlan, fillPlan, retroBuena, type Scenario } from '../helpers/scenario.js';

interface Field {
  field: string;
  label: string;
  kind: 'text' | 'list';
  status: 'CHANGE' | 'NO_CHANGE' | 'UNSURE' | 'NO_RESPONSE';
  currentValue: string | string[];
  proposedValue: string | string[] | null;
  rationale: string;
  basis: 'REGLAS' | 'DOCUMENTO' | 'INFERENCIA';
  criterionIds: string[];
  sources: { document: string; section: string | null }[];
  suggestion: { id: string; kind: string; status: string; effect: string; change: { field: string; currentValue: unknown; proposedValue: unknown } } | null;
}
interface Recommendation {
  artifact: { type: string; id: string; label: string; version: number | null; editable: boolean; hasRules: boolean };
  kind: 'RULES_AND_AI' | 'AI_ONLY';
  summary: string;
  fields: Field[];
  questions: string[];
  contextUsed: { projectData: string[]; documents: { document: string; sections: string[] }[] };
  providerNotice: string;
}
interface Resolved {
  suggestion: { status: string };
  result: { entity: string | null; id: string | null };
  revalidation: { runId: string; gateId: string; status: string } | null;
  notice: string;
}

describe('recomendaciones de IA campo por campo y propuestas de cambio', () => {
  let t: TestApp;
  let s: Scenario;
  let beto: TestUser;
  let intruso: TestUser;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    t.llm.reset();
    s = await createScenario(t.app);
    beto = await createUser(t.app, 'beto');
    await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
    intruso = await createUser(t.app, 'intruso');
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const p = () => `/projects/${s.projectId}`;
  const recomendar = (artifactType: string, artifactId: string, user = s.ana, projectId = s.projectId) =>
    user.client.post(`/projects/${projectId}/agent/recommend`, { artifactType, artifactId });
  const ok = async (artifactType: string, artifactId: string) => {
    const res = await recomendar(artifactType, artifactId);
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Recommendation;
  };
  const resolver = (id: string, body: object, user = s.ana) => user.client.post(`${p()}/agent/suggestions/${id}/resolve`, body);
  const aceptar = async (field: Field, edit?: object) => {
    const res = await resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true, ...(edit ? { edit } : {}) });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Resolved;
  };
  const prompt = () => t.llm.calls.at(-1)!.user;
  const evaluarHistoria = () => s.ana.client.post(`${p()}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: s.storyId });

  describe('una respuesta por campo', () => {
    it('cada campo editable recibe un estado explícito: cambio, sin cambios, dudas o sin pronunciamiento', async () => {
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      const por = Object.fromEntries(rec.fields.map((f) => [f.field, f]));
      expect(rec.fields.map((f) => f.field)).toEqual(['title', 'asA', 'iWant', 'soThat', 'acceptanceCriteria']);
      expect(por.title).toMatchObject({ status: 'CHANGE', basis: 'INFERENCIA' });
      expect(por.asA).toMatchObject({ status: 'NO_CHANGE', proposedValue: null });
      expect(por.iWant).toMatchObject({ status: 'UNSURE' });
      expect(por.iWant!.rationale).toMatch(/Falta contexto/);
      // El modelo omitió este campo: se dice claramente, no se inventa.
      expect(por.acceptanceCriteria).toMatchObject({ status: 'NO_RESPONSE', proposedValue: null });
      expect(por.acceptanceCriteria!.rationale).toMatch(/no se pronunció/i);
      expect(rec.questions.length).toBeGreaterThan(0);
    });

    it('solo los cambios recomendados generan propuestas, con valor actual y propuesto, y NO modifican nada', async () => {
      const antes = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      const conPropuesta = rec.fields.filter((f) => f.suggestion);
      expect(conPropuesta.map((f) => f.field)).toEqual(['title', 'soThat']);
      expect(conPropuesta[0]!.suggestion).toMatchObject({ kind: 'FIELD_CHANGE', status: 'PROPOSED' });
      expect(conPropuesta[0]!.suggestion!.change.currentValue).toBe(antes.title);
      expect(String(conPropuesta[0]!.proposedValue)).toContain('revisada por la IA simulada');
      const despues = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      expect(despues).toMatchObject({ title: antes.title, version: antes.version });
    });

    it('«sin cambios recomendados» en todos los campos se informa expresamente', async () => {
      await s.ana.client.patch(`${p()}/backlog/${s.storyId}`, {
        kind: 'USER_STORY',
        title: 'SIN-CAMBIOS-IA-SIMULADO historia',
        asA: 'Scrum Master',
        iWant: 'registrar la asistencia diaria del equipo en la reunión',
        soThat: 'puedo detectar ausencias recurrentes a tiempo',
        acceptanceCriteria: ['Se guarda la fecha y la hora del registro', 'Solo el Scrum Master puede modificar un registro guardado'],
        priority: 1,
        expectedVersion: 1,
      });
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      expect(rec.fields.filter((f) => f.status === 'NO_CHANGE').length).toBe(4);
      expect(rec.fields.some((f) => f.suggestion)).toBe(false);
    });

    it('la base de cada campo se verifica: «reglas» solo con criterios que de verdad fallaron', async () => {
      // Historia incompleta: la evaluación por reglas falla.
      const mala = (await s.ana.client.post(`${p()}/backlog`, { kind: 'USER_STORY', title: 'Idea suelta', asA: 'usuario', iWant: 'algo rápido', priority: 2 })).json() as { id: string };
      const run = (await s.ana.client.post(`${p()}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: mala.id })).json() as { status: string };
      expect(run.status).toBe('FAILED');
      const rec = await ok('BACKLOG_ITEM', mala.id);
      const title = rec.fields.find((f) => f.field === 'title')!;
      expect(title.basis).toBe('REGLAS');
      expect(title.criterionIds.length).toBe(1);
      expect(prompt()).toContain('Criterios no cumplidos');
    });

    it('con un documento citable, la cita se verifica contra lo enviado y la base pasa a «documento»', async () => {
      await s.ana.client.upload(`${p()}/documents`, { name: 'r.md', data: '# Registro de asistencia\nLa asistencia diaria se registra con fecha y hora en la reunión.' }, { name: 'Reglas' });
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      const title = rec.fields.find((f) => f.field === 'title')!;
      expect(title.basis).toBe('DOCUMENTO');
      expect(title.sources).toEqual([{ document: 'Reglas', section: 'Registro de asistencia' }]);
      expect(rec.contextUsed.documents).toEqual([{ document: 'Reglas', sections: ['Registro de asistencia'] }]);
      expect(title.suggestion!.change).toBeDefined();
    });

    it('una cita inventada por el modelo se descarta', async () => {
      t.llm.enqueueText(
        JSON.stringify({ type: 'field_recommendations', fields: [{ field: 'title', status: 'CHANGE', proposed: 'Otro título', rationale: 'x', sources: [{ document: 'Inventado', section: 'Cap. 1' }], criterionIds: ['STORY-04'] }] }),
      );
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      const title = rec.fields.find((f) => f.field === 'title')!;
      expect(title.sources).toEqual([]);
      expect(title.criterionIds).toEqual([]); // STORY-04 no falló en la última evaluación
      expect(title.basis).toBe('INFERENCIA');
    });

    it('un valor propuesto igual al actual cuenta como «sin cambios»; un CHANGE sin valor, como duda', async () => {
      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      t.llm.enqueueText(
        JSON.stringify({
          type: 'field_recommendations',
          fields: [
            { field: 'title', status: 'CHANGE', proposed: item.title },
            { field: 'asA', status: 'CHANGE' },
            { field: 'campoInexistente', status: 'CHANGE', proposed: 'x' },
          ],
        }),
      );
      const rec = await ok('BACKLOG_ITEM', s.storyId);
      expect(rec.fields.find((f) => f.field === 'title')!.status).toBe('NO_CHANGE');
      expect(rec.fields.find((f) => f.field === 'asA')!.status).toBe('UNSURE');
      expect(rec.fields.some((f) => f.field === 'campoInexistente')).toBe(false);
      expect(rec.fields.some((f) => f.suggestion)).toBe(false);
    });

    it('una salida inválida (campos extra) falla con un mensaje claro y no guarda propuestas', async () => {
      const bad = JSON.stringify({ type: 'field_recommendations', fields: [{ field: 'title', status: 'APROBAR' }] });
      t.llm.enqueueText(bad, bad);
      const res = await recomendar('BACKLOG_ITEM', s.storyId);
      expect(res.statusCode).toBe(502);
      expect(res.json().message).toMatch(/siguen funcionando/);
      expect(await getTestDb().aiSuggestion.count()).toBe(0);
    });
  });

  describe('cada tipo de artefacto', () => {
    it('Product Goal y Definition of Done: aplicar actualiza el proyecto con su versión, sin compuerta', async () => {
      const rec = await ok('PROJECT', s.projectId);
      expect(rec).toMatchObject({ kind: 'AI_ONLY', artifact: { editable: true, hasRules: false } });
      const field = rec.fields.find((f) => f.suggestion)!;
      expect(field.field).toBe('productGoal');
      const result = await aceptar(field);
      expect(result.revalidation).toBeNull();
      const project = await getTestDb().project.findUniqueOrThrow({ where: { id: s.projectId } });
      expect(project.productGoal).toContain('revisada por la IA simulada');
      expect(project.version).toBe(2);
    });

    it('planificación: aplicar cambia el Sprint Goal y reevalúa GATE-PLAN con las reglas', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      const rec = await ok('SPRINT', s.sprintId);
      expect(rec.kind).toBe('RULES_AND_AI');
      const field = rec.fields.find((f) => f.suggestion)!;
      expect(field.field).toBe('sprintGoal');
      const result = await aceptar(field);
      expect(result.revalidation).toMatchObject({ gateId: 'GATE-PLAN' });
      expect((await getTestDb().sprint.findUniqueOrThrow({ where: { id: s.sprintId } })).sprintGoal).toContain('revisada por la IA simulada');
    });

    it('Sprint Review: cambia un campo de texto y reevalúa GATE-REVIEW', async () => {
      await s.ana.client.put(`${s.base}/review`, { results: 'Se completaron 3 historias', increment: 'Formulario de asistencia', feedback: 'Piden un resumen semanal', goalAssessment: 'PARTIAL', goalAssessmentNote: 'Faltó el panel', expectedVersion: 1 });
      const rec = await ok('SPRINT_REVIEW', s.sprintId);
      const field = rec.fields.find((f) => f.suggestion)!;
      const result = await aceptar(field);
      expect(result.revalidation).toMatchObject({ gateId: 'GATE-REVIEW' });
      const review = await getTestDb().sprintReview.findUniqueOrThrow({ where: { sprintId: s.sprintId } });
      expect(review.results).toContain('revisada por la IA simulada');
      expect(review.goalAssessment).toBe('PARTIAL'); // lo que la propuesta no toca se conserva
    });

    it('retrospectiva: las listas se modifican completas y se reevalúa GATE-RETRO', async () => {
      await s.ana.client.put(`${s.base}/retrospective`, { ...retroBuena, expectedVersion: 1 });
      const rec = await ok('RETROSPECTIVE', s.sprintId);
      const field = rec.fields.find((f) => f.suggestion)!;
      expect(field).toMatchObject({ field: 'positives', kind: 'list' });
      expect(Array.isArray(field.proposedValue)).toBe(true);
      const result = await aceptar(field);
      expect(result.revalidation).toMatchObject({ gateId: 'GATE-RETRO' });
      const retro = await getTestDb().retrospective.findUniqueOrThrow({ where: { sprintId: s.sprintId } });
      expect(retro.positives).toContain('Elemento propuesto por la IA simulada');
      expect(retro.problems).toEqual(retroBuena.problems);
    });

    it('acción de retrospectiva y tarea del Sprint: se editan con su propia versión', async () => {
      const action = (await s.ana.client.post(`${s.base}/retrospective/actions`, { description: 'Limitar la reunión diaria a quince minutos' })).json() as { id: string };
      const ra = await ok('RETRO_ACTION', action.id);
      expect(ra.artifact.hasRules).toBe(true);
      const result = await aceptar(ra.fields.find((f) => f.suggestion)!);
      expect(result.revalidation).toMatchObject({ gateId: 'GATE-RETRO' });
      expect((await getTestDb().retroAction.findUniqueOrThrow({ where: { id: action.id } })).description).toContain('revisada por la IA simulada');

      const task = (await s.ana.client.post(`${s.base}/tasks`, { title: 'Diseñar el formulario' })).json() as { id: string };
      const rt = await ok('SPRINT_TASK', task.id);
      const r2 = await aceptar(rt.fields.find((f) => f.suggestion)!);
      expect(r2.revalidation).toBeNull();
      const updated = await getTestDb().sprintTask.findUniqueOrThrow({ where: { id: task.id } });
      expect(updated.title).toContain('revisada por la IA simulada');
      expect(updated.assigneeId).toBeNull(); // la IA nunca asigna personas
    });

    it('seguimiento: es un historial sin campos editables, así que solo hay análisis asesor (sin propuestas de cambio)', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      await s.ana.client.post(`${s.base}/stages/PLANNING/complete`);
      await s.ana.client.post(`${s.base}/tracking`, { kind: 'IMPEDIMENT', content: 'No hay acceso al servidor' });
      const rec = await ok('TRACKING', s.sprintId);
      expect(rec).toMatchObject({ kind: 'AI_ONLY', artifact: { editable: false, hasRules: false }, fields: [] });
      expect(rec.questions.length).toBeGreaterThan(0);
      expect(prompt()).toContain('No hay acceso al servidor');
      expect(prompt()).toContain('no tiene campos editables');
      expect(await getTestDb().aiSuggestion.count()).toBe(0);
    });
  });

  describe('aceptar, editar, descartar y conflictos', () => {
    it('editar el valor propuesto aplica lo editado y lo registra como editado, con autor y origen', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      const result = await beto.client.post(`${p()}/agent/suggestions/${field.suggestion!.id}/resolve`, { action: 'ACCEPT', confirm: true, edit: { value: 'Título escrito por una persona' } });
      expect(result.statusCode, result.body).toBe(200);
      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      expect(item.title).toBe('Título escrito por una persona');
      const activity = await getTestDb().activityLog.findFirst({ where: { action: 'suggestion.accepted' } });
      expect(activity).toMatchObject({ actorId: beto.id, payload: { kind: 'FIELD_CHANGE', origin: 'AI_SUGGESTION', edited: true } });
      expect(await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: field.suggestion!.id } })).toMatchObject({ status: 'ACCEPTED', resolvedBy: beto.id, appliedEntity: 'artifact' });
    });

    it('aceptar sin confirmación no cambia nada; un valor inválido da 422 y la propuesta sigue pendiente', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      expect((await resolver(field.suggestion!.id, { action: 'ACCEPT' })).statusCode).toBe(422);
      expect((await resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true, edit: { value: 'x'.repeat(130) } })).statusCode).toBe(422);
      expect((await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: field.suggestion!.id } })).status).toBe('PROPOSED');
    });

    it('descartar no cambia nada', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      expect((await resolver(field.suggestion!.id, { action: 'DISCARD' })).statusCode).toBe(200);
      expect((await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } })).version).toBe(1);
    });

    it('conflicto de versión: si el artefacto cambió después de la recomendación, NO se sobrescribe', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      await s.ana.client.patch(`${p()}/backlog/${s.storyId}`, {
        kind: item.kind,
        title: 'Título cambiado por el equipo',
        asA: item.asA,
        iWant: item.iWant,
        soThat: item.soThat,
        acceptanceCriteria: item.acceptanceCriteria,
        priority: item.priority,
        expectedVersion: item.version,
      });
      const res = await resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('VERSION_CONFLICT');
      expect(res.json().current.title).toBe('Título cambiado por el equipo');
      expect((await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } })).title).toBe('Título cambiado por el equipo');
      expect((await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: field.suggestion!.id } })).status).toBe('PROPOSED');
    });

    it('conflicto también en la planificación y en el proyecto', async () => {
      await fillPlan(s);
      const sprintRec = await ok('SPRINT', s.sprintId);
      const projectRec = await ok('PROJECT', s.projectId);
      const sprint = await getTestDb().sprint.findUniqueOrThrow({ where: { id: s.sprintId } });
      await s.ana.client.patch(s.base, { workPlan: `${sprint.workPlan} Y además pruebas.`, expectedVersion: sprint.version });
      const project = (await s.ana.client.get(p())).json() as { name: string; description: string; productGoal: string; version: number };
      await s.ana.client.patch(p(), { name: project.name, description: project.description, productGoal: 'Cambiado a mano', expectedVersion: project.version });
      expect((await resolver(sprintRec.fields.find((f) => f.suggestion)!.suggestion!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(409);
      expect((await resolver(projectRec.fields.find((f) => f.suggestion)!.suggestion!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(409);
      expect((await getTestDb().project.findUniqueOrThrow({ where: { id: s.projectId } })).productGoal).toBe('Cambiado a mano');
    });

    it('un Sprint cerrado ya no admite aplicar cambios y la propuesta sigue pendiente', async () => {
      await fillPlan(s);
      const field = (await ok('SPRINT', s.sprintId)).fields.find((f) => f.suggestion)!;
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
      expect((await resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(409);
      expect((await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: field.suggestion!.id } })).status).toBe('PROPOSED');
    });

    it('dos aceptaciones simultáneas: una se aplica y la otra recibe 409', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      const [a, b] = await Promise.all([resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true }), resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true }, beto)]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      expect((await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } })).version).toBe(2);
    });
  });

  describe('autorización, aislamiento y compuertas independientes de la IA', () => {
    it('un ajeno no puede pedir recomendaciones (404), un artefacto de otro proyecto tampoco, y el tipo inválido da 422', async () => {
      expect((await recomendar('BACKLOG_ITEM', s.storyId, intruso)).statusCode).toBe(404);
      const otro = await createScenario(t.app);
      expect((await recomendar('BACKLOG_ITEM', otro.storyId)).statusCode).toBe(404);
      expect((await recomendar('SPRINT', otro.sprintId)).statusCode).toBe(404);
      expect((await recomendar('PROJECT', otro.projectId)).statusCode).toBe(404);
      expect((await recomendar('COMPUERTA', s.storyId)).statusCode).toBe(422);
      expect(t.llm.calls).toHaveLength(0); // ninguna llamada al modelo en los casos rechazados
    });

    it('el contexto enviado no contiene datos de otros proyectos ni correos', async () => {
      const otro = await createScenario(t.app);
      await otro.ana.client.post(`/projects/${otro.projectId}/decisions`, { kind: 'DECISION', text: 'Decisión ajena confidencial' });
      await ok('BACKLOG_ITEM', s.storyId);
      const sent = t.llm.calls.map((c) => c.system + c.user).join('\n');
      expect(sent).not.toContain('confidencial');
      expect(sent).not.toContain(s.ana.email);
    });

    it('cualquier miembro puede pedir y aplicar (igual que editar a mano); queda el autor real', async () => {
      const rec = await (await recomendar('BACKLOG_ITEM', s.storyId, beto)).json() as Recommendation;
      expect(rec.fields.some((f) => f.suggestion)).toBe(true);
    });

    it('evaluar por reglas NO llama a la IA; pedir la recomendación sí, una sola vez', async () => {
      await evaluarHistoria();
      await fillPlan(s);
      await evaluatePlan(s);
      expect(t.llm.calls).toHaveLength(0);
      await ok('BACKLOG_ITEM', s.storyId);
      expect(t.llm.calls).toHaveLength(1);
    });

    it('la recomendación no cambia ningún estado de compuerta ni crea evaluaciones ni excepciones', async () => {
      await evaluarHistoria();
      const antes = await getTestDb().validationRun.count();
      await ok('BACKLOG_ITEM', s.storyId);
      await ok('PROJECT', s.projectId);
      expect(await getTestDb().validationRun.count()).toBe(antes);
      expect(await getTestDb().gateException.count()).toBe(0);
      const item = (await s.ana.client.get(`${p()}/backlog/${s.storyId}`)).json() as { gateState: string };
      expect(item.gateState).toBe('APROBADA');
    });

    it('tras aplicar, el estado lo decide la reevaluación por reglas (queda desactualizada→reevaluada), nunca la IA', async () => {
      await evaluarHistoria();
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      const res = await aceptar(field, { value: 'x' }); // un título de una letra sigue siendo válido
      const run = await getTestDb().validationRun.findUniqueOrThrow({ where: { id: res.revalidation!.runId } });
      expect(run).toMatchObject({ requestedBy: s.ana.id, aiStatus: 'NOT_REQUESTED', gateId: 'GATE-STORY' });
      expect(res.notice).toMatch(/La IA no aprueba compuertas/);
    });

    it('sin presupuesto de IA no se puede recomendar (429), pero las reglas y aplicar lo ya propuesto siguen funcionando', async () => {
      const field = (await ok('BACKLOG_ITEM', s.storyId)).fields.find((f) => f.suggestion)!;
      await getTestDb().agentInteraction.create({
        data: { projectId: s.projectId, userId: s.ana.id, kind: 'CHAT', promptVersion: 'v2', provider: 'fake', model: 'm', modelConfig: {}, question: 'q', status: 'OK', inputTokens: 500_000, outputTokens: 0, createdAt: t.clock.now() },
      });
      expect((await recomendar('BACKLOG_ITEM', s.storyId)).statusCode).toBe(429);
      expect((await evaluarHistoria()).statusCode).toBe(201);
      expect((await resolver(field.suggestion!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(200);
    });

    it('exige el token CSRF', async () => {
      const res = await s.ana.client.post(`${p()}/agent/recommend`, { artifactType: 'PROJECT', artifactId: s.projectId }, { csrf: false });
      expect(res.statusCode).toBe(403);
    });

    it('queda registrada como interacción de tipo RECOMMENDATION con modelo y versión del prompt', async () => {
      await ok('PROJECT', s.projectId);
      const row = await getTestDb().agentInteraction.findFirstOrThrow({ where: { projectId: s.projectId, kind: 'RECOMMENDATION' } });
      expect(row).toMatchObject({ status: 'OK', model: 'fake-model-v1', promptVersion: 'v2' });
    });
  });
});
