import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { createScenario, evaluatePlan, fillPlan, planBueno, retroBuena, type Scenario } from '../helpers/scenario.js';

/**
 * Prueba de contrato (T142): las respuestas reales de los endpoints principales deben cumplir los
 * esquemas de `contracts/openapi.yaml`. Si implementación y contrato divergen, falla esta prueba.
 */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const spec = yaml.load(
  readFileSync(path.resolve(import.meta.dirname, '../../../specs/001-scrum-ai-agent-guide/contracts/openapi.yaml'), 'utf-8'),
) as Json;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

/** Resuelve un `$ref` local del documento (p. ej. `#/components/responses/Problem`). */
function resolveRef<T extends Json>(node: T): Json {
  if (!node.$ref) return node;
  const target = (node.$ref as string)
    .replace(/^#\//, '')
    .split('/')
    .reduce<Json>((acc, key) => acc[key], spec);
  return resolveRef(target);
}

function schemaFor(template: string, method: string, status: number): Json {
  const operation = spec.paths[template]?.[method.toLowerCase()];
  if (!operation) throw new Error(`El contrato no define ${method} ${template}`);
  const response = operation.responses[String(status)];
  if (!response) throw new Error(`El contrato no define la respuesta ${status} de ${method} ${template}`);
  const content = resolveRef(response).content as Json | undefined;
  const media = content ? Object.values(content)[0] : undefined;
  return media?.schema ?? {};
}

/** Valida el cuerpo contra el esquema de la respuesta; los `$ref` internos se resuelven contra `components`. */
function expectContract(template: string, method: string, res: LightMyRequestResponse): void {
  const schema = schemaFor(template, method, res.statusCode);
  if (Object.keys(schema).length === 0) return; // sin cuerpo definido (p. ej. 204)
  const validate = ajv.compile({ components: spec.components, ...schema });
  const ok = validate(res.json());
  expect(ok, `${method} ${template} → ${res.statusCode}: ${JSON.stringify(validate.errors)}\n${res.body.slice(0, 400)}`).toBe(true);
}

describe('contrato OpenAPI frente a la implementación (T142)', () => {
  let t: TestApp;
  let s: Scenario;
  const p = () => `/projects/${s.projectId}`;

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

  it('salud, catálogo y sesión', async () => {
    expectContract('/health', 'GET', await t.app.inject({ method: 'GET', url: '/api/v1/health' }));
    expectContract('/auth/me', 'GET', await s.ana.client.get('/auth/me'));
    expectContract('/criteria-catalog', 'GET', await s.ana.client.get('/criteria-catalog'));
    const csrf = await t.app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    expectContract('/auth/csrf', 'GET', csrf);
  });

  it('proyectos y miembros', async () => {
    expectContract('/projects', 'GET', await s.ana.client.get('/projects'));
    expectContract('/projects/{projectId}', 'GET', await s.ana.client.get(p()));
    expectContract('/projects/{projectId}/members', 'GET', await s.ana.client.get(`${p()}/members`));
    expectContract('/projects', 'POST', await s.ana.client.post('/projects', { name: 'Otro proyecto', description: 'd', productGoal: 'Objetivo' }));
  });

  it('Product Backlog', async () => {
    expectContract('/projects/{projectId}/backlog', 'GET', await s.ana.client.get(`${p()}/backlog`));
    expectContract('/projects/{projectId}/backlog/{itemId}', 'GET', await s.ana.client.get(`${p()}/backlog/${s.storyId}`));
  });

  it('Sprint, etapas y evidencia', async () => {
    expectContract('/projects/{projectId}/sprints', 'GET', await s.ana.client.get(`${p()}/sprints`));
    expectContract('/projects/{projectId}/sprints/{sprintId}', 'GET', await s.ana.client.get(s.base));
    const filled = await fillPlan(s);
    expectContract('/projects/{projectId}/sprints/{sprintId}/items', 'PUT', await s.ana.client.put(`${s.base}/items`, { itemIds: [s.storyId], expectedVersion: filled.version }));
    expectContract('/projects/{projectId}/sprints/{sprintId}/stages/{stageType}/evidence', 'POST', await s.ana.client.post(`${s.base}/stages/PLANNING/evidence`, { content: 'Una evidencia' }));
    expectContract('/projects/{projectId}/sprints/{sprintId}/stages/{stageType}/evidence', 'GET', await s.ana.client.get(`${s.base}/stages/PLANNING/evidence`));
  });

  it('evaluación de compuertas', async () => {
    await fillPlan(s, planBueno);
    const run = await evaluatePlan(s);
    expectContract('/projects/{projectId}/validations', 'POST', run);
    const id = (run.json() as { id: string }).id;
    expectContract('/projects/{projectId}/validations', 'GET', await s.ana.client.get(`${p()}/validations`));
    expectContract('/projects/{projectId}/validations/{validationId}', 'GET', await s.ana.client.get(`${p()}/validations/${id}`));
  });

  it('seguimiento, Review y retrospectiva', async () => {
    await fillPlan(s);
    await evaluatePlan(s);
    await s.ana.client.post(`${s.base}/stages/PLANNING/complete`);
    const created = await s.ana.client.post(`${s.base}/tracking`, { kind: 'IMPEDIMENT', content: 'Sin acceso al servidor' });
    expectContract('/projects/{projectId}/sprints/{sprintId}/tracking', 'POST', created);
    expectContract('/projects/{projectId}/sprints/{sprintId}/tracking', 'GET', await s.ana.client.get(`${s.base}/tracking`));
    const entryId = (created.json() as { id: string }).id;
    expectContract('/projects/{projectId}/sprints/{sprintId}/tracking/{entryId}/resolve', 'POST', await s.ana.client.post(`${s.base}/tracking/${entryId}/resolve`));

    expectContract('/projects/{projectId}/sprints/{sprintId}/review', 'GET', await s.ana.client.get(`${s.base}/review`));
    expectContract(
      '/projects/{projectId}/sprints/{sprintId}/review',
      'PUT',
      await s.ana.client.put(`${s.base}/review`, { results: 'r', increment: 'i', feedback: 'f', goalAssessment: 'PARTIAL', goalAssessmentNote: 'n', expectedVersion: 1 }),
    );

    const retroUrl = `${s.base}/retrospective`;
    expectContract('/projects/{projectId}/sprints/{sprintId}/retrospective', 'GET', await s.ana.client.get(retroUrl));
    expectContract('/projects/{projectId}/sprints/{sprintId}/retrospective', 'PUT', await s.ana.client.put(retroUrl, { ...retroBuena, expectedVersion: 1 }));
    const action = await s.ana.client.post(`${retroUrl}/actions`, { description: 'Limitar la reunión diaria a quince minutos', ownerId: s.ana.id });
    expectContract('/projects/{projectId}/sprints/{sprintId}/retrospective/actions', 'POST', action);
    const actionId = (action.json() as { id: string }).id;
    expectContract(
      '/projects/{projectId}/sprints/{sprintId}/retrospective/actions/{actionId}',
      'PATCH',
      await s.ana.client.patch(`${retroUrl}/actions/${actionId}`, { status: 'DONE', expectedVersion: 1 }),
    );
  });

  it('asistente, actividad y errores', async () => {
    expectContract('/projects/{projectId}/agent/chat', 'POST', await s.ana.client.post(`${p()}/agent/chat`, { message: '¿Qué le falta a mi historia?' }));
    expectContract('/projects/{projectId}/agent/interactions', 'GET', await s.ana.client.get(`${p()}/agent/interactions`));
    expectContract('/projects/{projectId}/activity', 'GET', await s.ana.client.get(`${p()}/activity`));

    // Errores con formato Problem.
    expectContract('/projects/{projectId}/sprints/{sprintId}', 'GET', await s.ana.client.get(`${p()}/sprints/00000000-0000-4000-8000-000000000000`));
    expectContract('/projects/{projectId}/sprints/{sprintId}/review', 'PUT', await s.ana.client.put(`${s.base}/review`, { expectedVersion: 1 }));
    await s.ana.client.put(`${s.base}/review`, { results: '', increment: '', feedback: '', goalAssessment: null, goalAssessmentNote: '', expectedVersion: 1 });
    expectContract('/projects/{projectId}/sprints/{sprintId}/review', 'PUT', await s.ana.client.put(`${s.base}/review`, { results: '', increment: '', feedback: '', goalAssessment: null, goalAssessmentNote: '', expectedVersion: 1 }));
  });
});
