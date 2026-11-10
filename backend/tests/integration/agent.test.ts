import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError } from '../../src/modules/agent/llm/index.js';
import { PROMPT_VERSION } from '../../src/modules/agent/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, type TestUser } from '../helpers/factories.js';
import { createScenario, evaluatePlan, type Scenario } from '../helpers/scenario.js';

const respuestaValida = {
  type: 'chat_reply',
  answer: 'A la historia le falta un criterio de aceptación. Es un criterio adicional del prototipo.',
  suggestions: [{ target: 'HU-1.criterios', text: 'Agregue un criterio que se pueda comprobar con sí o no.' }],
  referencedCriteria: ['STORY-04'],
};

describe('asistente con IA simulada (T089, FR-020, FR-024, FR-024a, FR-025)', () => {
  let t: TestApp;
  let ana: TestUser;
  let projectId: string;
  const preguntar = (message = '¿Qué le falta a mi historia?', user = ana, extra: object = {}) =>
    user.client.post(`/projects/${projectId}/agent/chat`, { message, ...extra });
  const interacciones = () => getTestDb().agentInteraction.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    t.llm.reset();
    ana = await createUser(t.app, 'ana');
    projectId = (await createProject(ana)).id;
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('responde con una recomendación etiquetada y el aviso de que no está garantizada', async () => {
    t.llm.enqueueText(JSON.stringify(respuestaValida));
    const res = await preguntar();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ source: 'AI_RECOMMENDATION', answer: respuestaValida.answer, referencedCriteria: ['STORY-04'] });
    expect(body.disclaimer).toMatch(/puede contener errores/i);
    expect(body.suggestions).toHaveLength(1);
    expect(body.model).toBe('fake-model-v1');
    expect(body.interactionId).toBeTruthy();
  });

  it('sin guion responde con la respuesta simulada por defecto', async () => {
    const res = await preguntar();
    expect(res.statusCode).toBe(200);
    expect(res.json().answer).toMatch(/simulada/i);
  });

  it('cada interacción guarda proveedor, modelo, configuración, versión de prompt, estado, tokens y latencia (FR-025, SC-008)', async () => {
    t.llm.enqueue({ kind: 'ok', text: JSON.stringify(respuestaValida), inputTokens: 321, outputTokens: 45 });
    await preguntar('Mi pregunta concreta');
    const [fila] = await interacciones();
    expect(fila).toMatchObject({
      kind: 'CHAT',
      provider: 'fake',
      model: 'fake-model-v1',
      promptVersion: PROMPT_VERSION,
      status: 'OK',
      question: 'Mi pregunta concreta',
      inputTokens: 321,
      outputTokens: 45,
      latencyMs: 5,
    });
    expect(fila!.modelConfig).toMatchObject({ temperature: expect.any(Number), maxOutputTokens: expect.any(Number), timeoutMs: expect.any(Number) });
    expect((fila!.response as { answer: string }).answer).toBe(respuestaValida.answer);
  });

  it('el prompt enviado incluye el objetivo del producto y delimita los datos', async () => {
    await preguntar('¿Cómo estamos?');
    const enviado = t.llm.calls[0]!;
    expect(enviado.system).toMatch(/NO decides aprobaciones/);
    expect(enviado.user).toContain('Un objetivo de producto de prueba');
    expect(enviado.user).toMatch(/<datos_usuario>\n¿Cómo estamos\?\n<\/datos_usuario>/);
  });

  describe('salida inválida del modelo', () => {
    it('JSON inservible y luego válido: un único reintento de reparación y respuesta correcta', async () => {
      t.llm.enqueueText('{"type":"chat_reply"}', JSON.stringify(respuestaValida));
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(t.llm.calls).toHaveLength(2);
      expect(t.llm.calls[1]!.user).toMatch(/no cumplió el formato JSON/);
      expect((await interacciones())[0]!.status).toBe('OK');
    });

    it('una respuesta en texto plano (sin JSON) se usa como respuesta, sin reintento ni error', async () => {
      t.llm.enqueueText('Para HU-2 empiece por el formulario de inicio de sesión.');
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(res.json().answer).toBe('Para HU-2 empiece por el formulario de inicio de sesión.');
      expect(t.llm.calls).toHaveLength(1);
    });

    it('un JSON cortado por el límite de tokens rescata el texto de la respuesta', async () => {
      t.llm.enqueueText('{"type":"chat_reply","answer":"Plan sugerido: diseñar, implementar y probar","suggestions":[{"target":"HU-2","text":"Empe');
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(res.json().answer).toBe('Plan sugerido: diseñar, implementar y probar');
    });

    it('dos respuestas inválidas: AI_INVALID_RESPONSE (502) y se registra INVALID_RESPONSE', async () => {
      t.llm.enqueueText('{"type":"chat_reply"}', '{"otra":"cosa"}');
      const res = await preguntar();
      expect(res.statusCode).toBe(502);
      expect(res.json().code).toBe('AI_INVALID_RESPONSE');
      expect(res.json().message).toMatch(/reglas/i);
      expect(t.llm.calls).toHaveLength(2);
      const [fila] = await interacciones();
      expect(fila).toMatchObject({ status: 'INVALID_RESPONSE', response: null });
    });

    it('respuesta vacía se trata como inválida', async () => {
      t.llm.enqueueText('', '   ');
      expect((await preguntar()).json().code).toBe('AI_INVALID_RESPONSE');
    });

    it('un campo no permitido (por ejemplo, "aprobar") se ignora: la respuesta se usa sin él', async () => {
      t.llm.enqueueText(JSON.stringify({ ...respuestaValida, aprobar: true, gateState: 'APROBADA' }));
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('aprobar');
      expect(res.body).not.toContain('gateState');
    });
  });

  describe('errores del proveedor', () => {
    it('error transitorio y luego éxito: un reintento', async () => {
      t.llm.enqueueError(new LlmProviderError('503', 503)).enqueueText(JSON.stringify(respuestaValida));
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(t.llm.calls).toHaveLength(2);
    });

    it('error persistente: AI_UNAVAILABLE (502) tras un solo reintento', async () => {
      t.llm.enqueueError(new LlmProviderError('500', 500)).enqueueError(new LlmProviderError('500', 500));
      const res = await preguntar();
      expect(res.statusCode).toBe(502);
      expect(res.json().code).toBe('AI_UNAVAILABLE');
      expect(t.llm.calls).toHaveLength(2);
      expect((await interacciones())[0]!.status).toBe('PROVIDER_ERROR');
    });

    it('tiempo agotado: AI_TIMEOUT (502) sin reintento', async () => {
      t.llm.enqueueError(new LlmTimeoutError());
      const res = await preguntar();
      expect(res.statusCode).toBe(502);
      expect(res.json().code).toBe('AI_TIMEOUT');
      expect(t.llm.calls).toHaveLength(1);
      expect((await interacciones())[0]!.status).toBe('TIMEOUT');
    });

    it('429 del proveedor y luego éxito: un reintento respetando retry-after', async () => {
      t.llm.enqueueError(new LlmRateLimitError(1)).enqueueText(JSON.stringify(respuestaValida));
      const res = await preguntar();
      expect(res.statusCode).toBe(200);
      expect(t.llm.calls).toHaveLength(2);
    });

    it('429 persistente: AI_BUDGET_EXCEEDED (429) tras un reintento', async () => {
      t.llm.enqueueError(new LlmRateLimitError(1)).enqueueError(new LlmRateLimitError(1));
      const res = await preguntar();
      expect(res.statusCode).toBe(429);
      expect(res.json().code).toBe('AI_BUDGET_EXCEEDED');
      expect((await interacciones())[0]!.status).toBe('BUDGET_EXCEEDED');
    });

    it('los disparadores simulados de fallo funcionan sin guion (para las pruebas funcionales)', async () => {
      expect((await preguntar('FALLO-IA-SIMULADO')).json().code).toBe('AI_UNAVAILABLE');
      expect((await preguntar('TIMEOUT-IA-SIMULADO')).json().code).toBe('AI_TIMEOUT');
    });
  });

  describe('límites de uso (FR-024a)', () => {
    it('presupuesto diario por proyecto agotado: 429 con la hora de restablecimiento y sin llamar al modelo', async () => {
      await getTestDb().agentInteraction.create({
        data: { projectId, userId: ana.id, kind: 'CHAT', promptVersion: 'v1', provider: 'fake', model: 'm', modelConfig: {}, question: 'q', status: 'OK', inputTokens: 30_000, outputTokens: 10_000, createdAt: t.clock.now() },
      });
      const res = await preguntar();
      expect(res.statusCode).toBe(429);
      expect(res.json().code).toBe('AI_BUDGET_EXCEEDED');
      expect(res.json().message).toMatch(/UTC/);
      expect(t.llm.calls).toHaveLength(0);
      const ultimo = (await interacciones()).at(-1)!;
      expect(ultimo.status).toBe('BUDGET_EXCEEDED');
    });

    it('el presupuesto de un proyecto no bloquea a otro', async () => {
      await getTestDb().agentInteraction.create({
        data: { projectId, userId: ana.id, kind: 'CHAT', promptVersion: 'v1', provider: 'fake', model: 'm', modelConfig: {}, question: 'q', status: 'OK', inputTokens: 40_000, outputTokens: 0, createdAt: t.clock.now() },
      });
      const otro = await createProject(ana);
      const res = await ana.client.post(`/projects/${otro.id}/agent/chat`, { message: 'Hola' });
      expect(res.statusCode).toBe(200);
    });

    it('límite por persona y minuto: la solicitud 11 recibe 429 RATE_LIMITED', async () => {
      let ultimo = 0;
      for (let i = 0; i < 11; i += 1) ultimo = (await preguntar(`Pregunta ${i}`)).statusCode;
      expect(ultimo).toBe(429);
    });

    it('el contador es por persona: otra persona del proyecto no queda bloqueada', async () => {
      const beto = await createUser(t.app, 'beto');
      await addMember(ana, projectId, beto, 'PARTICIPANT');
      for (let i = 0; i < 10; i += 1) await preguntar(`P${i}`);
      expect((await preguntar('una más')).statusCode).toBe(429);
      expect((await preguntar('desde Beto', beto)).statusCode).toBe(200);
    });
  });

  describe('validación de entrada y acceso', () => {
    it.each([
      ['mensaje vacío', { message: '' }],
      ['mensaje de solo espacios', { message: '   ' }],
      ['mensaje de 2001 caracteres', { message: 'x'.repeat(2001) }],
      ['sin mensaje', {}],
      ['foco con identificador inválido', { message: 'hola', focus: { targetType: 'BACKLOG_ITEM', targetId: 'no-uuid' } }],
    ])('rechaza %s con 422', async (_caso, body) => {
      const res = await ana.client.post(`/projects/${projectId}/agent/chat`, body);
      expect(res.statusCode).toBe(422);
      expect(t.llm.calls).toHaveLength(0);
    });

    it('acepta un mensaje de exactamente 2000 caracteres', async () => {
      expect((await preguntar('x'.repeat(2000))).statusCode).toBe(200);
    });

    it('un Participante también puede preguntar; una persona ajena al proyecto recibe 404', async () => {
      const beto = await createUser(t.app, 'beto');
      await addMember(ana, projectId, beto, 'PARTICIPANT');
      expect((await preguntar('hola', beto)).statusCode).toBe(200);
      const intruso = await createUser(t.app, 'intruso');
      expect((await preguntar('hola', intruso)).statusCode).toBe(404);
      expect((await intruso.client.get(`/projects/${projectId}/agent/interactions`)).statusCode).toBe(404);
    });
  });

  describe('contexto', () => {
    it('con foco en una historia incluye su contenido y los criterios no cumplidos con su origen', async () => {
      const item = (
        await ana.client.post(`/projects/${projectId}/backlog`, { kind: 'USER_STORY', title: 'Idea suelta', asA: 'usuario', iWant: 'algo rápido', soThat: 'sea mejor', acceptanceCriteria: [], priority: 1 })
      ).json() as { id: string };
      await ana.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: item.id });
      await preguntar('¿Qué falta?', ana, { focus: { targetType: 'BACKLOG_ITEM', targetId: item.id } });
      const enviado = t.llm.calls[0]!.user;
      expect(enviado).toContain('HU-1 · Idea suelta');
      expect(enviado).toContain('STORY-04');
      expect(enviado).toContain('Criterio adicional del prototipo');
    });

    it('nunca envía correos ni seudónimos de las personas', async () => {
      const beto = await createUser(t.app, 'beto');
      await addMember(ana, projectId, beto, 'FACILITATOR');
      await preguntar('hola');
      const enviado = t.llm.calls[0]!.system + t.llm.calls[0]!.user;
      for (const dato of [ana.email, beto.email, ana.pseudonym, beto.pseudonym]) expect(enviado).not.toContain(dato);
    });

    it('un foco de otro proyecto no filtra datos (se ignora)', async () => {
      const beto = await createUser(t.app, 'beto');
      const pb = await createProject(beto);
      const ajeno = (await beto.client.post(`/projects/${pb.id}/backlog`, { kind: 'ITEM', title: 'Secreto de Beto', description: 'Texto confidencial ajeno', priority: 1 })).json() as { id: string };
      await preguntar('hola', ana, { focus: { targetType: 'BACKLOG_ITEM', targetId: ajeno.id } });
      expect(t.llm.calls[0]!.user).not.toContain('Secreto de Beto');
      expect(t.llm.calls[0]!.user).not.toContain('confidencial');
    });

    it('usa como máximo las últimas 4 interacciones exitosas del propio usuario', async () => {
      for (let i = 0; i < 6; i += 1) await preguntar(`pregunta-previa-${i}`);
      t.llm.calls.length = 0;
      await preguntar('la actual');
      const enviado = t.llm.calls[0]!.user;
      expect(enviado).toContain('pregunta-previa-5');
      expect(enviado).toContain('pregunta-previa-2');
      expect(enviado).not.toContain('pregunta-previa-1');
    });
  });

  describe('historial de interacciones', () => {
    it('lista modelo, versión de prompt, estado y seudónimo (sin correos)', async () => {
      await preguntar('Hola asistente');
      const lista = (await ana.client.get(`/projects/${projectId}/agent/interactions`)).json() as Record<string, unknown>[];
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ kind: 'CHAT', model: 'fake-model-v1', promptVersion: PROMPT_VERSION, status: 'OK', question: 'Hola asistente' });
      expect(lista[0]!.userPseudonym).toBe(ana.pseudonym);
      expect(JSON.stringify(lista)).not.toContain(ana.email);
    });
  });

  describe('retroalimentación de IA sobre una evaluación (bajo demanda)', () => {
    let s: Scenario;
    beforeEach(async () => {
      s = await createScenario(t.app);
      t.llm.reset();
    });

    it('POST /validations por defecto no consulta a la IA (aiStatus NOT_REQUESTED)', async () => {
      const res = await evaluatePlan(s);
      expect(res.json().aiStatus).toBe('NOT_REQUESTED');
      expect(res.json().aiObservations).toEqual([]);
      expect(t.llm.calls).toHaveLength(0);
    });

    it('POST .../ai-feedback añade observaciones etiquetadas sin cambiar el estado ni crear un intento', async () => {
      const run = (await evaluatePlan(s)).json() as { id: string; status: string; attemptNo: number };
      t.llm.enqueueText(JSON.stringify({ type: 'validation_feedback', summary: 'Resumen', observations: [{ criterionId: 'PLAN-01', text: 'Defina un objetivo.', suggestedRewrite: 'Permitir que el equipo…' }] }));
      const res = await s.ana.client.post(`/projects/${s.projectId}/validations/${run.id}/ai-feedback`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({ id: run.id, status: run.status, attemptNo: run.attemptNo, aiStatus: 'OK' });
      expect(body.aiObservations[0]).toMatchObject({ criterionId: 'PLAN-01', source: 'AI_RECOMMENDATION', suggestedRewrite: 'Permitir que el equipo…' });
      expect(await getTestDb().validationRun.count({ where: { targetId: s.sprintId } })).toBe(1);
      const [fila] = await getTestDb().agentInteraction.findMany({ where: { validationRunId: run.id } });
      expect(fila).toMatchObject({ kind: 'VALIDATION_FEEDBACK', status: 'OK' });
    });

    it('con requestAiFeedback=true se piden las observaciones junto con la evaluación', async () => {
      const res = await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: s.sprintId, requestAiFeedback: true });
      expect(res.statusCode).toBe(201);
      expect(res.json().aiStatus).toBe('OK');
      expect(res.json().aiObservations.length).toBeGreaterThan(0);
    });

    it('si la IA falla, la evaluación sigue creada y el estado de IA lo refleja (nunca aprueba por error)', async () => {
      t.llm.enqueueError(new LlmTimeoutError());
      const res = await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: s.sprintId, requestAiFeedback: true });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ status: 'FAILED', aiStatus: 'TIMEOUT', aiObservations: [] });
    });

    it('ai-feedback con la IA caída devuelve 502 y la evaluación por reglas queda intacta', async () => {
      const run = (await evaluatePlan(s)).json() as { id: string };
      t.llm.enqueueError(new LlmProviderError('500', 500)).enqueueError(new LlmProviderError('500', 500));
      const res = await s.ana.client.post(`/projects/${s.projectId}/validations/${run.id}/ai-feedback`);
      expect(res.statusCode).toBe(502);
      const detalle = (await s.ana.client.get(`/projects/${s.projectId}/validations/${run.id}`)).json();
      expect(detalle).toMatchObject({ id: run.id, status: 'FAILED', aiStatus: 'PROVIDER_ERROR' });
    });

    it('una evaluación de otro proyecto no admite retroalimentación (404)', async () => {
      const run = (await evaluatePlan(s)).json() as { id: string };
      const beto = await createUser(t.app, 'beto');
      const pb = await createProject(beto);
      expect((await beto.client.post(`/projects/${pb.id}/validations/${run.id}/ai-feedback`)).statusCode).toBe(404);
    });
  });
});
