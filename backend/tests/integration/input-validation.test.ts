import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { historiaBuena, createScenario, type Scenario } from '../helpers/scenario.js';

/**
 * Entradas inválidas (T141, FR-033): cuerpos vacíos, con tipos incorrectos, cadenas desmesuradas y
 * caracteres especiales. Todo error de validación responde 422 con un Problem en español y sin trazas.
 */
interface Case {
  name: string;
  method: 'post' | 'put' | 'patch';
  path: (s: Scenario) => string;
  /** Cuerpo válido de referencia. */
  valid: (s: Scenario) => Record<string, unknown>;
  /** Campos de texto (se prueban con tipo incorrecto y con una cadena desmesurada). */
  strings: string[];
}

const cases: Case[] = [
  { name: 'crear proyecto', method: 'post', path: () => '/projects', valid: () => ({ name: 'Proyecto válido', description: 'd', productGoal: 'Objetivo' }), strings: ['name', 'description', 'productGoal'] },
  { name: 'agregar miembro', method: 'post', path: (s) => `/projects/${s.projectId}/members`, valid: () => ({ email: 'nueva@ejemplo.test', role: 'PARTICIPANT' }), strings: ['email', 'role'] },
  { name: 'crear elemento del backlog', method: 'post', path: (s) => `/projects/${s.projectId}/backlog`, valid: () => ({ ...historiaBuena }), strings: ['title', 'asA', 'iWant', 'soThat'] },
  { name: 'evaluar compuerta', method: 'post', path: (s) => `/projects/${s.projectId}/validations`, valid: (s) => ({ gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: s.storyId }), strings: ['gateId', 'targetType', 'targetId'] },
  { name: 'evidencia', method: 'post', path: (s) => `${s.base}/stages/PLANNING/evidence`, valid: () => ({ content: 'texto' }), strings: ['content'] },
  { name: 'editar Sprint', method: 'patch', path: (s) => s.base, valid: () => ({ sprintGoal: 'Objetivo', expectedVersion: 1 }), strings: ['sprintGoal', 'workPlan'] },
  { name: 'seleccionar elementos', method: 'put', path: (s) => `${s.base}/items`, valid: (s) => ({ itemIds: [s.storyId], expectedVersion: 1 }), strings: [] },
  { name: 'registrar seguimiento', method: 'post', path: (s) => `${s.base}/tracking`, valid: () => ({ kind: 'PROGRESS', content: 'avance' }), strings: ['kind', 'content'] },
  { name: 'guardar Review', method: 'put', path: (s) => `${s.base}/review`, valid: () => ({ results: 'r', increment: 'i', feedback: 'f', goalAssessment: null, goalAssessmentNote: '', expectedVersion: 1 }), strings: ['results', 'increment', 'feedback', 'goalAssessmentNote'] },
  { name: 'guardar retrospectiva', method: 'put', path: (s) => `${s.base}/retrospective`, valid: () => ({ positives: ['a'], problems: ['b'], improvements: ['c'], expectedVersion: 1 }), strings: [] },
  { name: 'crear acción', method: 'post', path: (s) => `${s.base}/retrospective/actions`, valid: () => ({ description: 'Una acción válida del equipo' }), strings: ['description', 'followUpNote'] },
  { name: 'preguntar al asistente', method: 'post', path: (s) => `/projects/${s.projectId}/agent/chat`, valid: () => ({ message: 'Hola' }), strings: ['message'] },
];

function expectCleanProblem(res: { statusCode: number; body: string; json: () => unknown }) {
  expect(res.statusCode).toBe(422);
  const body = res.json() as { code: string; message: string };
  expect(body.code).toBe('VALIDATION_ERROR');
  expect(body.message).toMatch(/[a-záéíóú]/i);
  // Sin trazas ni detalles internos.
  expect(res.body).not.toMatch(/\bat \S+ \(|node_modules|prisma|ZodError|stack/i);
}

describe('entradas inválidas en todos los endpoints con cuerpo (T141)', () => {
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

  describe.each(cases)('$name', (c) => {
    it('cuerpo vacío y cuerpo de tipo equivocado (arreglo) → 422', async () => {
      expectCleanProblem(await s.ana.client[c.method](c.path(s), {}));
      expectCleanProblem(await s.ana.client[c.method](c.path(s), []));
    });

    it('JSON mal formado → 422', async () => {
      const token = await s.ana.client.csrfToken();
      const res = await t.app.inject({
        method: c.method.toUpperCase() as 'POST',
        url: `/api/v1${c.path(s)}`,
        headers: { 'content-type': 'application/json', 'x-csrf-token': token, cookie: [...s.ana.client.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
        payload: '{"campo": ',
      });
      expectCleanProblem(res);
    });

    it.each(['número', 'objeto', 'lista'])('un campo de texto recibe un %s → 422', async (tipo) => {
      const wrong = tipo === 'número' ? 12345 : tipo === 'objeto' ? { a: 1 } : ['x'];
      for (const field of c.strings) {
        expectCleanProblem(await s.ana.client[c.method](c.path(s), { ...c.valid(s), [field]: wrong }));
      }
    });

    it('un campo de texto desmesurado (50 000 caracteres) → 422', async () => {
      for (const field of c.strings) {
        expectCleanProblem(await s.ana.client[c.method](c.path(s), { ...c.valid(s), [field]: 'x'.repeat(50_000) }));
      }
    });
  });

  it('los caracteres especiales se guardan como texto y se devuelven escapados (sin ejecutar nada)', async () => {
    const raro = `<script>alert(1)</script> "comillas" 'simples' \\ barra ñandú 😀 \u0000`.replace('\u0000', '');
    const res = await s.ana.client.post(`${s.base}/tracking`, { kind: 'PROGRESS', content: raro });
    // Antes de validar la planificación, el seguimiento está bloqueado (409); el texto nunca causa 5xx.
    expect([201, 409]).toContain(res.statusCode);
    const evidence = await s.ana.client.post(`${s.base}/stages/PLANNING/evidence`, { content: raro });
    expect(evidence.statusCode).toBe(201);
    expect(evidence.headers['content-type']).toContain('application/json');
    expect((evidence.json() as { content: string }).content).toBe(raro.trim());
  });

  it('un identificador mal formado en la ruta responde 404 sin detalles internos', async () => {
    const res = await s.ana.client.get(`/projects/no-es-un-uuid/sprints/otro`);
    expect([404, 422]).toContain(res.statusCode);
    expect(res.body).not.toMatch(/prisma|stack|node_modules/i);
  });

  it('un cuerpo mayor que el límite (1 MiB) se rechaza sin caerse', async () => {
    const res = await s.ana.client.post(`${s.base}/stages/PLANNING/evidence`, { content: 'x'.repeat(1_100_000) });
    expect([413, 422]).toContain(res.statusCode);
  });
});
