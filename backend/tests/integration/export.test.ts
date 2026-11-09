import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser } from '../helpers/factories.js';
import { DATASET_COLUMNS, parseCsv, TEXT_COLUMNS } from '../helpers/export.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, type Scenario } from '../helpers/scenario.js';

type Dataset = keyof typeof DATASET_COLUMNS;
type Row = Record<string, unknown>;
interface ExportJson {
  schema_version: string;
  exported_at: string;
  project_id: string;
  is_sample: boolean;
  include_text: boolean;
  catalog_version: string;
  datasets: Record<Dataset, Row[]>;
}

const JUSTIFICACION = 'El equipo acordó con el docente avanzar con un plan provisional.';

describe('exportación CSV y JSON (T120, FR-026–FR-030, SC-006, SC-007)', () => {
  let t: TestApp;
  let s: Scenario;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    t.llm.reset();
    s = await createScenario(t.app);
    // Historia del recorrido: intento 1 FAILED, intento 2 FAILED, intento 3 PASSED, y luego se avanza.
    await evaluatePlan(s); // 1: FAILED (Sprint vacío)
    t.clock.advance(30_000);
    const sprint = (await s.ana.client.get(s.base)).json() as { version: number };
    await s.ana.client.patch(s.base, { sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel', expectedVersion: sprint.version });
    await evaluatePlan(s); // 2: FAILED (sin plan ni elementos)
    t.clock.advance(30_000);
    await fillPlan(s);
    await evaluatePlan(s); // 3: PASSED
    t.clock.advance(60_000);
    await completeStage(s, 'PLANNING');
    await s.ana.client.post(`/projects/${s.projectId}/agent/chat`, { message: '¿Qué sigue ahora?' });
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const json = async (query = '', user = s.ana) => {
    const res = await user.client.get(`/projects/${s.projectId}/export?format=json${query}`);
    expect(res.statusCode, res.body).toBe(200);
    return JSON.parse(res.body) as ExportJson;
  };
  const csv = async (dataset: Dataset, query = '', user = s.ana) => {
    const res = await user.client.get(`/projects/${s.projectId}/export?format=csv&dataset=${dataset}${query}`);
    expect(res.statusCode, res.body).toBe(200);
    return { res, ...parseCsv(res.body) };
  };

  describe('JSON', () => {
    it('incluye los metadatos y los seis conjuntos de datos', async () => {
      const doc = await json();
      expect(doc).toMatchObject({ schema_version: '1.0.0', project_id: s.projectId, is_sample: false, include_text: false, catalog_version: '1.0.0' });
      expect(doc.exported_at).toBe(t.clock.now().toISOString());
      expect(Object.keys(doc.datasets).sort()).toEqual(Object.keys(DATASET_COLUMNS).sort());
    });

    it('cada conjunto trae exactamente las columnas del contrato', async () => {
      const doc = await json();
      for (const name of Object.keys(DATASET_COLUMNS) as Dataset[]) {
        const row = doc.datasets[name][0];
        if (!row) continue; // sin filas (p. ej. excepciones): sus columnas se comprueban en el CSV y en la prueba de excepciones
        expect(Object.keys(row).sort()).toEqual([...DATASET_COLUMNS[name]].sort());
      }
    });

    it('responde como descarga con el nombre y el tipo de contenido esperados', async () => {
      const res = await s.ana.client.get(`/projects/${s.projectId}/export?format=json`);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="export-.+\.json"/);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('coincidencia con la aplicación (SC-006)', () => {
    it('las evaluaciones exportadas coinciden con las de la API, con sus intentos y criterios', async () => {
      const doc = await json();
      const api = (await s.ana.client.get(`/projects/${s.projectId}/validations`)).json() as { id: string; attemptNo: number; status: string; results: unknown[] }[];
      expect(doc.datasets.validation_runs).toHaveLength(api.length);
      for (const run of api) {
        const fila = doc.datasets.validation_runs.find((r) => r.validation_id === run.id)!;
        expect(fila).toMatchObject({ attempt_no: run.attemptNo, status: run.status, passed: run.status === 'PASSED' });
        expect(doc.datasets.criterion_results.filter((c) => c.validation_id === run.id)).toHaveLength(run.results.length);
      }
    });

    it('las actividades exportadas coinciden con el historial de la API', async () => {
      const api = (await s.ana.client.get(`/projects/${s.projectId}/activity?limit=200`)).json() as { id: number; action: string }[];
      const doc = await json();
      expect(doc.datasets.activities.map((a) => Number(a.activity_id)).sort((x, y) => x - y)).toEqual(api.map((a) => a.id).sort((x, y) => x - y));
      expect(doc.datasets.activities.map((a) => a.action)).toContain('stage.completed');
    });

    it('las interacciones del asistente coinciden con las de la API', async () => {
      const api = (await s.ana.client.get(`/projects/${s.projectId}/agent/interactions`)).json() as { id: string; model: string; promptVersion: string }[];
      const doc = await json();
      expect(doc.datasets.agent_interactions).toHaveLength(api.length);
      expect(doc.datasets.agent_interactions[0]).toMatchObject({ interaction_id: api[0]!.id, model: 'fake-model-v1', prompt_version: 'v1', provider: 'fake', kind: 'CHAT', status: 'OK' });
    });

    it('los datos de CSV y de JSON son los mismos', async () => {
      const doc = await json();
      for (const name of Object.keys(DATASET_COLUMNS) as Dataset[]) {
        const { rows } = await csv(name);
        // La primera exportación (JSON) queda registrada como actividad y aparece en las siguientes.
        const extra = name === 'activities' ? 1 : 0;
        expect(rows, name).toHaveLength(doc.datasets[name].length + extra);
      }
    });
  });

  describe('medidas objetivas', () => {
    it('intentos hasta aprobar: la compuerta de planificación se aprobó en el intento 3 (2 intentos previos)', async () => {
      const { rows } = await csv('validation_runs');
      const plan = rows.filter((r) => r.gate_id === 'GATE-PLAN').sort((a, b) => Number(a.attempt_no) - Number(b.attempt_no));
      expect(plan.map((r) => [r.attempt_no, r.status, r.passed])).toEqual([['1', 'FAILED', 'false'], ['2', 'FAILED', 'false'], ['3', 'PASSED', 'true']]);
      expect(plan.every((r) => r.attempts_before_pass === '2')).toBe(true);
      expect(plan.map((r) => r.sprint_number)).toEqual(['1', '1', '1']);
    });

    it('un objetivo nunca aprobado deja attempts_before_pass vacío', async () => {
      const mala = (await s.ana.client.post(`/projects/${s.projectId}/backlog`, { kind: 'USER_STORY', title: 'Mala', asA: 'u', iWant: 'algo rápido', soThat: 'x', acceptanceCriteria: [], priority: 9 })).json() as { id: string };
      await s.ana.client.post(`/projects/${s.projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: mala.id });
      const { rows } = await csv('validation_runs');
      const fila = rows.find((r) => r.target_id === mala.id)!;
      expect(fila).toMatchObject({ status: 'FAILED', attempts_before_pass: '', sprint_number: '', mandatory_not_met_count: expect.any(String) });
      expect(Number(fila.mandatory_not_met_count)).toBeGreaterThan(0);
    });

    it('duración de la etapa en segundos enteros derivada de las marcas del servidor; vacía si no se completó', async () => {
      const { rows } = await csv('stage_durations');
      const planning = rows.find((r) => r.stage_type === 'PLANNING')!;
      expect(planning.status).toBe('VALIDATED');
      expect(planning.duration_seconds).toBe('90'); // la etapa empieza con la primera edición (+30 s) y se cierra 60 s después de la última evaluación
      const tracking = rows.find((r) => r.stage_type === 'TRACKING')!;
      expect(tracking).toMatchObject({ started_at: '', completed_at: '', duration_seconds: '' });
    });

    it('las fechas son ISO 8601 UTC con milisegundos y la duración de cada evaluación está en milisegundos', async () => {
      const doc = await json();
      for (const run of doc.datasets.validation_runs) {
        expect(run.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(run.finished_at).toMatch(/Z$/);
        expect(typeof run.duration_ms).toBe('number');
      }
    });

    it('las excepciones se exportan con autor (seudónimo), compuerta y fecha', async () => {
      const otra = await createScenario(t.app);
      await otra.ana.client.patch(otra.base, { sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel', expectedVersion: 1 });
      const run = (await evaluatePlan(otra)).json() as { id: string };
      await otra.ana.client.post(`/projects/${otra.projectId}/validations/${run.id}/exception`, { justification: JUSTIFICACION });
      const res = await otra.ana.client.get(`/projects/${otra.projectId}/export?format=json`);
      const doc = JSON.parse(res.body) as ExportJson;
      expect(doc.datasets.exceptions).toHaveLength(1);
      expect(doc.datasets.exceptions[0]).toMatchObject({ validation_id: run.id, gate_id: 'GATE-PLAN', authorized_by_pseudonym: otra.ana.pseudonym });
      const fila = doc.datasets.validation_runs.find((r) => r.validation_id === run.id)!;
      expect(fila.has_exception).toBe(true);
    });

    it('los valores ausentes quedan vacíos (CSV) o null (JSON); nunca inventados', async () => {
      const doc = await json();
      const trackingJson = doc.datasets.stage_durations.find((r) => r.stage_type === 'TRACKING')!;
      expect(trackingJson).toMatchObject({ started_at: null, completed_at: null, duration_seconds: null });
      const sinResponsable = doc.datasets.validation_runs.find((r) => r.sprint_number === null);
      expect(sinResponsable === undefined || sinResponsable.sprint_number === null).toBe(true);
    });
  });

  describe('CSV', () => {
    it.each(Object.keys(DATASET_COLUMNS) as Dataset[])('%s: cabecera exacta del contrato, BOM y saltos \\r\\n', async (name) => {
      const { res, header } = await csv(name);
      expect(res.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
      expect(res.headers['content-disposition']).toMatch(new RegExp(`attachment; filename="${name}-.+\\.csv"`));
      expect(res.body.startsWith('﻿')).toBe(true);
      expect(res.body).toContain('\r\n');
      expect(header).toEqual([...DATASET_COLUMNS[name]]);
    });

    it('con includeText=true se añaden las columnas de texto marcadas (texto)', async () => {
      for (const name of ['criterion_results', 'exceptions', 'agent_interactions'] as const) {
        const { header } = await csv(name, '&includeText=true');
        expect(header).toEqual([...DATASET_COLUMNS[name], ...TEXT_COLUMNS[name]]);
      }
      const { rows } = await csv('agent_interactions', '&includeText=true');
      expect(rows[0]!.question).toBe('¿Qué sigue ahora?');
      expect(rows[0]!.answer).toMatch(/simulada/);
    });

    it('sin includeText no hay columnas de texto libre', async () => {
      const { header } = await csv('agent_interactions');
      expect(header).not.toContain('question');
      expect(header).not.toContain('answer');
    });
  });

  describe('parámetros inválidos', () => {
    it.each([
      ['sin formato', ''],
      ['formato desconocido', '?format=xml'],
      ['csv sin dataset', '?format=csv'],
      ['dataset desconocido', '?format=csv&dataset=usuarios'],
      ['includeText inválido', '?format=json&includeText=quizas'],
    ])('rechaza %s con 422', async (_caso, query) => {
      const res = await s.ana.client.get(`/projects/${s.projectId}/export${query}`);
      expect(res.statusCode).toBe(422);
    });
  });

  describe('acceso', () => {
    it('un Participante no puede exportar (403)', async () => {
      const beto = await createUser(t.app, 'beto');
      await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
      expect((await beto.client.get(`/projects/${s.projectId}/export?format=json`)).statusCode).toBe(403);
    });
    it('un ajeno al proyecto recibe 404 y sin sesión 401', async () => {
      const intruso = await createUser(t.app, 'intruso');
      expect((await intruso.client.get(`/projects/${s.projectId}/export?format=json`)).statusCode).toBe(404);
      const { TestClient } = await import('../helpers/client.js');
      expect((await new TestClient(t.app).get(`/projects/${s.projectId}/export?format=json`)).statusCode).toBe(401);
    });
    it('la exportación solo contiene datos del proyecto pedido', async () => {
      const otra = await createScenario(t.app);
      await evaluatePlan(otra);
      const doc = await json();
      expect(doc.datasets.validation_runs.every((r) => r.project_id === s.projectId)).toBe(true);
      expect(JSON.stringify(doc)).not.toContain(otra.projectId);
    });
  });

  describe('datos de ejemplo (FR-030, SC-007)', () => {
    beforeEach(async () => {
      await getTestDb().project.update({ where: { id: s.projectId }, data: { isSample: true } });
    });
    it('se excluyen por defecto: 409 con un mensaje claro', async () => {
      const res = await s.ana.client.get(`/projects/${s.projectId}/export?format=json`);
      expect(res.statusCode).toBe(409);
      expect(res.json().message).toMatch(/demostración/i);
      expect((await s.ana.client.get(`/projects/${s.projectId}/export?format=csv&dataset=activities`)).statusCode).toBe(409);
    });
    it('con includeSample=true se incluyen y cada fila lleva is_sample = true', async () => {
      const doc = await json('&includeSample=true');
      expect(doc.is_sample).toBe(true);
      for (const rows of Object.values(doc.datasets)) for (const row of rows) expect(row.is_sample).toBe(true);
      const { rows } = await csv('activities', '&includeSample=true');
      expect(rows.every((r) => r.is_sample === 'true')).toBe(true);
    });
  });

  it('cada exportación queda registrada en el historial, solo con metadatos', async () => {
    const antes = (await s.ana.client.get(`/projects/${s.projectId}/activity?limit=200`)).json() as unknown[];
    await json('&includeText=true');
    await csv('exceptions');
    const despues = (await s.ana.client.get(`/projects/${s.projectId}/activity?limit=200`)).json() as { action: string }[];
    expect(despues.length).toBe(antes.length + 2);
    expect(despues.filter((a) => a.action === 'export.generated')).toHaveLength(2);
    const filas = await getTestDb().activityLog.findMany({ where: { action: 'export.generated' } });
    expect(JSON.stringify(filas.map((f) => f.payload))).not.toMatch(/Qué sigue|justificación/i);
    expect(filas[0]!.payload).toMatchObject({ format: 'json', includeText: true });
  });
});
