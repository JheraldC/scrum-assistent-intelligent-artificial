import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { createScenario, fillPlan, type Scenario } from '../helpers/scenario.js';

interface Proposal {
  id: string;
  kind: string;
  status: string;
  actionable: boolean;
  title: string;
  itemCode: string | null;
  itemId: string | null;
  acceptanceCriteria: string[];
  sources: { document: string; section: string | null }[];
  basis: string;
  effect: string;
}
interface Reply {
  answer: string;
  proposals: Proposal[];
  basis: string;
  sources: { document: string; section: string | null }[];
  contextUsed: { projectData: string[]; documents: { document: string; sections: string[] }[]; documentsAvailable: number; focus: string | null };
  providerNotice: string;
}
interface Resolved {
  suggestion: Proposal;
  result: { entity: string | null; id: string | null };
  revalidation: { runId: string; gateId: string; status: string; attemptNo: number } | null;
}

const REGLAS = '# Reglas del negocio\nUna falta se justifica con certificado en 48 horas.\n\n# Arquitectura\nAPI REST y base relacional.';
const PROPONER = 'PROPUESTA-IA-SIMULADA ¿Cómo justificar una falta con certificado?';

describe('asistente: contexto de documentos y sugerencias revisables', () => {
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
  const preguntar = async (message: string, user = s.ana, projectId = s.projectId) => {
    const res = await user.client.post(`/projects/${projectId}/agent/chat`, { message });
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Reply;
  };
  const subirDoc = (name: string, data: string, user = s.ana, projectId = s.projectId) =>
    user.client.upload(`/projects/${projectId}/documents`, { name: `${name}.md`, data }, { name });
  const resolver = (id: string, body: object, user = s.ana, projectId = s.projectId) =>
    user.client.post(`/projects/${projectId}/agent/suggestions/${id}/resolve`, body);
  const prompt = () => t.llm.calls.at(-1)!.user;
  const backlogCount = () => getTestDb().backlogItem.count({ where: { projectId: s.projectId } });

  describe('contexto', () => {
    it('sin documentos funciona con el contexto del proyecto y lo explica', async () => {
      const reply = await preguntar('¿Qué hago primero?');
      expect(reply.contextUsed.documentsAvailable).toBe(0);
      expect(reply.contextUsed.documents).toEqual([]);
      expect(reply.contextUsed.projectData).toEqual(expect.arrayContaining(['Objetivo del producto', 'Sprint activo y su Sprint Goal']));
      expect(prompt()).not.toContain('Documentos disponibles');
      expect(prompt()).toContain('Objetivo del producto');
      expect(reply.basis).toBe('INFERENCIA');
      expect(reply.providerNotice).toMatch(/proveedor externo de IA/);
    });

    it('el contexto crece con los datos reales: backlog, Sprint Goal, decisiones y Definition of Done', async () => {
      await fillPlan(s);
      await s.ana.client.post(`${p()}/decisions`, { kind: 'AGREEMENT', text: 'Daily a las nueve' });
      const project = (await s.ana.client.get(p())).json() as { name: string; description: string; productGoal: string; version: number };
      await s.ana.client.patch(p(), { ...project, definitionOfDone: 'Con pruebas y revisado', expectedVersion: project.version });
      await preguntar('Resume el estado');
      for (const expected of ['HU-1', 'Sprint Goal:', 'Daily a las nueve', 'Definition of Done: Con pruebas y revisado']) {
        expect(prompt()).toContain(expected);
      }
    });

    it('envía solo fragmentos pertinentes de documentos activos y los cita con documento y sección', async () => {
      await subirDoc('Reglas', REGLAS);
      const reply = await preguntar(PROPONER);
      expect(prompt()).toContain('[Documento: «Reglas» | Sección: «Reglas del negocio»]');
      expect(prompt()).toContain('certificado en 48 horas');
      expect(prompt()).not.toContain('API REST'); // la otra sección no es pertinente
      expect(reply.basis).toBe('DOCUMENTO');
      expect(reply.sources).toEqual([{ document: 'Reglas', section: 'Reglas del negocio' }]);
      expect(reply.contextUsed.documents).toEqual([{ document: 'Reglas', sections: ['Reglas del negocio'] }]);
    });

    it('los documentos desactualizados o excluidos no se envían', async () => {
      const doc = (await subirDoc('Reglas', REGLAS)).json() as { id: string };
      await s.ana.client.patch(`${p()}/documents/${doc.id}`, { status: 'OUTDATED' });
      await preguntar(PROPONER);
      expect(prompt()).not.toContain('certificado en 48 horas');
      await s.ana.client.patch(`${p()}/documents/${doc.id}`, { status: 'ACTIVE', includeInContext: false });
      await preguntar(PROPONER);
      expect(prompt()).not.toContain('certificado en 48 horas');
      await s.ana.client.patch(`${p()}/documents/${doc.id}`, { includeInContext: true });
      await preguntar(PROPONER);
      expect(prompt()).toContain('certificado en 48 horas');
    });

    it('usa la versión vigente del documento', async () => {
      const doc = (await subirDoc('Reglas', REGLAS)).json() as { id: string };
      await s.ana.client.upload(`${p()}/documents/${doc.id}/versions`, { name: 'reglas2.md', data: '# Reglas del negocio\nLa falta se justifica con certificado en 72 horas.' });
      await preguntar(PROPONER);
      expect(prompt()).toContain('72 horas');
      expect(prompt()).not.toContain('48 horas');
    });

    it('nunca envía datos, documentos ni backlog de otro proyecto, ni correos', async () => {
      const otro = await createScenario(t.app);
      await subirDoc('Secreto ajeno', '# Reglas del negocio\nCertificado falta confidencial del otro proyecto', otro.ana, otro.projectId);
      await otro.ana.client.post(`/projects/${otro.projectId}/decisions`, { kind: 'DECISION', text: 'Decisión ajena confidencial' });
      await subirDoc('Reglas', REGLAS);
      await preguntar(PROPONER);
      const sent = t.llm.calls.map((c) => c.system + c.user).join('\n');
      expect(sent).not.toContain('confidencial');
      expect(sent).not.toContain('Secreto ajeno');
      expect(sent).not.toContain(s.ana.email);
      expect(sent).not.toContain(beto.email);
    });

    it('una cita inventada por el modelo se descarta y la base pasa a «inferencia»', async () => {
      await subirDoc('Reglas', REGLAS);
      t.llm.enqueueText(JSON.stringify({ type: 'chat_reply', answer: 'Según el documento…', basis: 'DOCUMENTO', sources: [{ document: 'Documento inventado', section: 'Capítulo 9' }] }));
      const reply = await preguntar(PROPONER);
      expect(reply.sources).toEqual([]);
      expect(reply.basis).toBe('INFERENCIA');
    });

    it('una sección inexistente de un documento real se cita solo por el documento', async () => {
      await subirDoc('Reglas', REGLAS);
      t.llm.enqueueText(JSON.stringify({ type: 'chat_reply', answer: 'x', sources: [{ document: 'Reglas', section: 'Sección falsa' }] }));
      const reply = await preguntar(PROPONER);
      expect(reply.sources).toEqual([{ document: 'Reglas', section: null }]);
    });
  });

  describe('propuestas', () => {
    it('quedan pendientes y NO cambian nada del proyecto hasta que una persona las acepta', async () => {
      const before = await backlogCount();
      const reply = await preguntar(PROPONER);
      expect(reply.proposals.map((x) => x.kind)).toEqual(['STORY', 'ACCEPTANCE_CRITERIA', 'TASK', 'RISK', 'QUESTION']);
      expect(reply.proposals.every((x) => x.status === 'PROPOSED')).toBe(true);
      expect(reply.proposals.map((x) => x.actionable)).toEqual([true, true, true, false, false]);
      expect(await backlogCount()).toBe(before);
      expect(await getTestDb().sprintTask.count()).toBe(0);
      expect(await getTestDb().validationRun.count({ where: { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', attemptNo: { gt: 1 } } })).toBe(0);
    });

    it('cada propuesta explica su efecto antes de aplicarse', async () => {
      const reply = await preguntar(PROPONER);
      const [story, criteria, task] = reply.proposals;
      expect(story!.effect).toMatch(/Se creará la historia/);
      expect(criteria!.effect).toMatch(/Se añadirán 1 criterio\(s\).*HU-1.*conflicto/);
      expect(task!.effect).toMatch(/sin responsable asignado/);
    });

    it('con una propuesta basada en un documento muestra su cita; sin documento, es inferencia', async () => {
      const sin = await preguntar(PROPONER);
      expect(sin.proposals[0]).toMatchObject({ basis: 'INFERENCIA', sources: [] });
      await subirDoc('Reglas', REGLAS);
      const con = await preguntar(PROPONER);
      expect(con.proposals[0]).toMatchObject({ basis: 'DOCUMENTO', sources: [{ document: 'Reglas', section: 'Reglas del negocio' }] });
    });

    it('se listan por estado y se comparten con el equipo del proyecto, no con otros', async () => {
      await preguntar(PROPONER);
      const pendientes = (await beto.client.get(`${p()}/agent/suggestions?status=PROPOSED`)).json() as Proposal[];
      expect(pendientes).toHaveLength(5);
      expect((await intruso.client.get(`${p()}/agent/suggestions`)).statusCode).toBe(404);
      expect((await s.ana.client.get(`${p()}/agent/suggestions?status=INVALIDO`)).statusCode).toBe(422);
    });

    it('un código de elemento inexistente deja la propuesta sin destino', async () => {
      t.llm.enqueueText(JSON.stringify({ type: 'chat_reply', answer: 'x', proposals: [{ kind: 'ACCEPTANCE_CRITERIA', text: 'x', itemCode: 'HU-99', acceptanceCriteria: ['Un criterio nuevo y verificable'] }] }));
      const reply = await preguntar('Hola');
      expect(reply.proposals[0]).toMatchObject({ itemId: null, itemCode: null });
      expect(reply.proposals[0]!.effect).toMatch(/Elija el elemento/);
    });

    it('una salida con campos no permitidos (p. ej. asignar personas) se rechaza como inválida', async () => {
      const bad = JSON.stringify({ type: 'chat_reply', answer: 'x', proposals: [{ kind: 'TASK', title: 't', text: 'x', assignee: 'ana' }] });
      t.llm.enqueueText(bad, bad);
      const res = await s.ana.client.post(`${p()}/agent/chat`, { message: 'Hola' });
      expect(res.statusCode).toBe(502);
      expect(await getTestDb().aiSuggestion.count()).toBe(0);
    });
  });

  describe('aceptar, editar o descartar', () => {
    it('aceptar exige confirmación explícita', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      expect((await resolver(story!.id, { action: 'ACCEPT' })).statusCode).toBe(422);
      expect((await resolver(story!.id, { action: 'ACCEPT', confirm: false })).statusCode).toBe(422);
      expect(await backlogCount()).toBe(1);
    });

    it('aceptar una historia la crea al final del backlog, la reevalúa con las REGLAS y deja constancia de origen y autor', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      const res = await beto.client.post(`${p()}/agent/suggestions/${story!.id}/resolve`, { action: 'ACCEPT', confirm: true });
      expect(res.statusCode, res.body).toBe(200);
      const body = res.json() as Resolved & { notice: string };
      expect(body.suggestion.status).toBe('ACCEPTED');
      expect(body.result.entity).toBe('backlog_item');
      expect(body.notice).toMatch(/La IA no aprueba compuertas/);

      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: body.result.id! } });
      expect(item).toMatchObject({ code: 'HU-2', priority: 2, createdBy: beto.id, kind: 'USER_STORY' });
      // La evaluación la hizo el motor de reglas, a nombre de quien aceptó, sin IA.
      const run = await getTestDb().validationRun.findUniqueOrThrow({ where: { id: body.revalidation!.runId } });
      expect(run).toMatchObject({ gateId: 'GATE-STORY', targetId: item.id, requestedBy: beto.id, aiStatus: 'NOT_REQUESTED' });
      const row = await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: story!.id } });
      expect(row).toMatchObject({ status: 'ACCEPTED', resolvedBy: beto.id, appliedEntity: 'backlog_item', appliedId: item.id });
      const activity = await getTestDb().activityLog.findFirst({ where: { action: 'suggestion.accepted' } });
      expect(activity).toMatchObject({ actorId: beto.id, entityId: story!.id, payload: { kind: 'STORY', origin: 'AI_SUGGESTION', edited: false } });
    });

    it('se puede editar antes de aceptar: se aplica lo editado, no lo propuesto', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      const res = await resolver(story!.id, {
        action: 'ACCEPT',
        confirm: true,
        edit: { title: 'Título corregido por una persona', acceptanceCriteria: ['El resumen se descarga en formato CSV'] },
      });
      const body = res.json() as Resolved;
      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: body.result.id! } });
      expect(item.title).toBe('Título corregido por una persona');
      expect(item.acceptanceCriteria).toEqual(['El resumen se descarga en formato CSV']);
      const activity = await getTestDb().activityLog.findFirst({ where: { action: 'suggestion.accepted' } });
      expect(activity!.payload).toMatchObject({ edited: true });
    });

    it('una edición inválida se rechaza (422) y la propuesta sigue pendiente', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      expect((await resolver(story!.id, { action: 'ACCEPT', confirm: true, edit: { title: 'x'.repeat(201) } })).statusCode).toBe(422);
      expect((await resolver(story!.id, { action: 'ACCEPT', confirm: true, edit: { asignar: 'ana' } })).statusCode).toBe(422);
      expect(await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: story!.id } })).toMatchObject({ status: 'PROPOSED' });
      expect(await backlogCount()).toBe(1);
    });

    it('aceptar criterios los añade al elemento (sin duplicar), sube su versión y lo reevalúa con las reglas', async () => {
      const [, criteria] = (await preguntar(PROPONER)).proposals;
      const before = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      const res = (await resolver(criteria!.id, { action: 'ACCEPT', confirm: true })).json() as Resolved;
      const after = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      expect(after.acceptanceCriteria).toEqual([...before.acceptanceCriteria, 'Se muestra un mensaje claro cuando falta información']);
      expect(after.version).toBe(before.version + 1);
      expect(res.revalidation!.gateId).toBe('GATE-STORY');
      expect(res.revalidation!.attemptNo).toBe(2); // la evaluación inicial del escenario fue el intento 1
    });

    it('conflicto de versión: si el elemento cambió después de la propuesta, NO se sobrescribe y la propuesta sigue pendiente', async () => {
      const [, criteria] = (await preguntar(PROPONER)).proposals;
      const item = (await s.ana.client.get(`${p()}/backlog/${s.storyId}`)).json() as { version: number; kind: string; title: string; asA: string; iWant: string; soThat: string; priority: number; acceptanceCriteria: string[] };
      const edit = await s.ana.client.patch(`${p()}/backlog/${s.storyId}`, {
        kind: item.kind,
        title: 'Cambiado por el equipo mientras tanto',
        asA: item.asA,
        iWant: item.iWant,
        soThat: item.soThat,
        acceptanceCriteria: item.acceptanceCriteria,
        priority: item.priority,
        expectedVersion: item.version,
      });
      expect(edit.statusCode, edit.body).toBe(200);

      const res = await resolver(criteria!.id, { action: 'ACCEPT', confirm: true });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('VERSION_CONFLICT');
      expect(res.json().current.title).toBe('Cambiado por el equipo mientras tanto');
      const after = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      expect(after.title).toBe('Cambiado por el equipo mientras tanto');
      expect(after.acceptanceCriteria).toHaveLength(item.acceptanceCriteria.length);
      expect(await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: criteria!.id } })).toMatchObject({ status: 'PROPOSED' });
    });

    it('al elegir otro destino se aplica sobre su versión vigente', async () => {
      const [, criteria] = (await preguntar(PROPONER)).proposals;
      const otra = (await s.ana.client.post(`${p()}/backlog`, { kind: 'USER_STORY', title: 'Otra historia', asA: 'Rol', iWant: 'hacer una cosa útil para el equipo', soThat: 'se gana tiempo en la reunión', priority: 2 })).json() as { id: string };
      const res = await resolver(criteria!.id, { action: 'ACCEPT', confirm: true, edit: { itemId: otra.id } });
      expect(res.statusCode, res.body).toBe(200);
      expect((await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: otra.id } })).acceptanceCriteria).toContain('Se muestra un mensaje claro cuando falta información');
    });

    it('sin destino válido pide elegir el elemento (422) y no acepta uno de otro proyecto', async () => {
      t.llm.enqueueText(JSON.stringify({ type: 'chat_reply', answer: 'x', proposals: [{ kind: 'ACCEPTANCE_CRITERIA', text: 'x', acceptanceCriteria: ['Un criterio nuevo y verificable'] }] }));
      const [sinDestino] = (await preguntar('Hola')).proposals;
      expect((await resolver(sinDestino!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(422);
      const otro = await createScenario(t.app);
      expect((await resolver(sinDestino!.id, { action: 'ACCEPT', confirm: true, edit: { itemId: otro.storyId } })).statusCode).toBe(404);
    });

    it('aceptar una tarea la crea en el Sprint abierto, sin responsable y marcada como de origen IA', async () => {
      await fillPlan(s);
      const [, , task] = (await preguntar(PROPONER)).proposals;
      expect(task).toMatchObject({ itemCode: 'HU-1' });
      const res = (await resolver(task!.id, { action: 'ACCEPT', confirm: true })).json() as Resolved;
      expect(res.revalidation).toBeNull(); // las tareas no pasan por compuertas
      const created = await getTestDb().sprintTask.findUniqueOrThrow({ where: { id: res.result.id! } });
      expect(created).toMatchObject({ title: 'Diseñar la pantalla del resumen', assigneeId: null, fromAi: true, backlogItemId: s.storyId, createdBy: s.ana.id, status: 'TODO' });
    });

    it('si el elemento no está seleccionado en el Sprint, la tarea queda sin elemento (no se inventa la relación)', async () => {
      const [, , task] = (await preguntar(PROPONER)).proposals;
      expect(task!.itemCode).toBeNull();
      const res = (await resolver(task!.id, { action: 'ACCEPT', confirm: true })).json() as Resolved;
      expect((await getTestDb().sprintTask.findUniqueOrThrow({ where: { id: res.result.id! } })).backlogItemId).toBeNull();
    });

    it('sin Sprint abierto no se puede crear la tarea (409) y la propuesta sigue pendiente', async () => {
      const [, , task] = (await preguntar(PROPONER)).proposals;
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
      expect((await resolver(task!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(409);
      expect(await getTestDb().aiSuggestion.findUniqueOrThrow({ where: { id: task!.id } })).toMatchObject({ status: 'PROPOSED' });
    });

    it('riesgos y preguntas son informativos: aceptarlos solo los marca como revisados', async () => {
      const [, , , risk] = (await preguntar(PROPONER)).proposals;
      const res = (await resolver(risk!.id, { action: 'ACCEPT', confirm: true })).json() as Resolved;
      expect(res.result).toEqual({ entity: null, id: null });
      expect(res.revalidation).toBeNull();
      expect(await backlogCount()).toBe(1);
    });

    it('descartar no cambia nada y queda registrado', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      const res = (await resolver(story!.id, { action: 'DISCARD' })).json() as Resolved;
      expect(res.suggestion.status).toBe('DISCARDED');
      expect(await backlogCount()).toBe(1);
      expect(await getTestDb().activityLog.count({ where: { action: 'suggestion.discarded' } })).toBe(1);
    });

    it('una propuesta ya resuelta no se vuelve a aplicar (409), ni con dos aceptaciones simultáneas', async () => {
      const [story, criteria] = (await preguntar(PROPONER)).proposals;
      await resolver(story!.id, { action: 'DISCARD' });
      expect((await resolver(story!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(409);
      const [a, b] = await Promise.all([resolver(criteria!.id, { action: 'ACCEPT', confirm: true }), beto.client.post(`${p()}/agent/suggestions/${criteria!.id}/resolve`, { action: 'ACCEPT', confirm: true })]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const item = await getTestDb().backlogItem.findUniqueOrThrow({ where: { id: s.storyId } });
      expect(item.acceptanceCriteria.filter((c) => c === 'Se muestra un mensaje claro cuando falta información')).toHaveLength(1);
    });

    it('autorización: un ajeno recibe 404 y una sugerencia de otro proyecto no se puede resolver', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      expect((await resolver(story!.id, { action: 'DISCARD' }, intruso)).statusCode).toBe(404);
      const otro = await createScenario(t.app);
      expect((await resolver(story!.id, { action: 'DISCARD' }, otro.ana, otro.projectId)).statusCode).toBe(404);
      expect((await resolver('no-es-uuid', { action: 'DISCARD' })).statusCode).toBe(404);
    });

    it('exige el token CSRF para resolver', async () => {
      const [story] = (await preguntar(PROPONER)).proposals;
      const res = await s.ana.client.post(`${p()}/agent/suggestions/${story!.id}/resolve`, { action: 'DISCARD' }, { csrf: false });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('la IA no decide compuertas y el producto funciona sin ella', () => {
    it('aceptar una sugerencia no aprueba nada: el estado lo fijan las reglas y no se crea ninguna excepción', async () => {
      const [, criteria] = (await preguntar(PROPONER)).proposals;
      await resolver(criteria!.id, { action: 'ACCEPT', confirm: true });
      expect(await getTestDb().gateException.count()).toBe(0);
      const runs = await getTestDb().validationRun.findMany({ where: { projectId: s.projectId }, orderBy: { attemptNo: 'asc' } });
      expect(runs.every((r) => r.aiStatus === 'NOT_REQUESTED')).toBe(true);
    });

    it('sin presupuesto de IA se puede seguir aceptando y descartando lo ya propuesto', async () => {
      const [story, criteria] = (await preguntar(PROPONER)).proposals;
      await getTestDb().agentInteraction.create({
        data: { projectId: s.projectId, userId: s.ana.id, kind: 'CHAT', promptVersion: 'v2', provider: 'fake', model: 'm', modelConfig: {}, question: 'q', status: 'OK', inputTokens: 500_000, outputTokens: 0, createdAt: t.clock.now() },
      });
      expect((await s.ana.client.post(`${p()}/agent/chat`, { message: 'otra' })).statusCode).toBe(429);
      expect((await resolver(story!.id, { action: 'DISCARD' })).statusCode).toBe(200);
      expect((await resolver(criteria!.id, { action: 'ACCEPT', confirm: true })).statusCode).toBe(200);
    });

    it('con el proveedor caído el chat falla con un mensaje claro y las vistas, tareas y compuertas siguen funcionando', async () => {
      const res = await s.ana.client.post(`${p()}/agent/chat`, { message: 'FALLO-IA-SIMULADO' });
      expect(res.statusCode).toBe(502);
      expect(res.json().message).toMatch(/siguen funcionando/);
      expect((await s.ana.client.get(`${p()}/views/scrum-master`)).statusCode).toBe(200);
      expect((await s.ana.client.post(`${s.base}/tasks`, { title: 'Sigue funcionando' })).statusCode).toBe(201);
      expect(((await s.ana.client.post(`${p()}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: s.storyId })).json() as { status: string }).status).toBe('PASSED');
    });
  });
});
