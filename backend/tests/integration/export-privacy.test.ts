import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { DATASET_COLUMNS, parseCsv } from '../helpers/export.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, type Scenario } from '../helpers/scenario.js';

type Dataset = keyof typeof DATASET_COLUMNS;

describe('privacidad de la exportación (T121, FR-028, FR-030, SC-006, SC-007)', () => {
  let t: TestApp;
  let s: Scenario;
  let beto: TestUser;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    t.llm.reset();
    s = await createScenario(t.app);
    beto = await createUser(t.app, 'beto');
    await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
    await fillPlan(s);
    await evaluatePlan(s);
    await completeStage(s, 'PLANNING');
    // Interacciones con textos que parecen datos sensibles o fórmulas.
    await s.ana.client.post(`/projects/${s.projectId}/agent/chat`, { message: '=HYPERLINK("http://malo.example","clic")' });
    await beto.client.post(`/projects/${s.projectId}/agent/chat`, { message: '@cmd+datos, "comillas" y\nsalto de línea' });
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  /** Todas las salidas posibles: JSON y cada CSV, con y sin texto libre. */
  async function todasLasSalidas(user: TestUser = s.ana): Promise<Record<string, string>> {
    const salidas: Record<string, string> = {};
    for (const includeText of [false, true]) {
      const json = await user.client.get(`/projects/${s.projectId}/export?format=json&includeText=${includeText}`);
      salidas[`json-${includeText}`] = json.body;
      for (const name of Object.keys(DATASET_COLUMNS) as Dataset[]) {
        salidas[`${name}-${includeText}`] = (await user.client.get(`/projects/${s.projectId}/export?format=csv&dataset=${name}&includeText=${includeText}`)).body;
      }
    }
    return salidas;
  }

  it('ninguna salida contiene correos, hashes, tokens ni claves', async () => {
    const hash = (await getTestDb().user.findFirstOrThrow({ where: { email: s.ana.email } })).passwordHash;
    const sesiones = await getTestDb().session.findMany();
    const prohibidos = [s.ana.email, beto.email, 'ejemplo.test', '$argon2', hash.slice(0, 20), 'passwordHash', 'password_hash', 'csrf', 'SESSION_SECRET', ...sesiones.map((x) => x.tokenHash)];
    const salidas = await todasLasSalidas();
    for (const [nombre, contenido] of Object.entries(salidas)) {
      for (const dato of prohibidos) expect(contenido, `${nombre} contiene «${dato}»`).not.toContain(dato);
    }
  });

  it('las personas aparecen solo con su seudónimo', async () => {
    const doc = JSON.parse((await s.ana.client.get(`/projects/${s.projectId}/export?format=json`)).body) as { datasets: Record<string, Record<string, unknown>[]> };
    const vistos = new Set<string>();
    for (const rows of Object.values(doc.datasets)) {
      for (const row of rows) for (const [k, v] of Object.entries(row)) if (k.endsWith('pseudonym') && typeof v === 'string') vistos.add(v);
    }
    expect([...vistos].every((p) => /^P-[A-Z2-9]{6}$/.test(p))).toBe(true);
    expect(vistos.has(s.ana.pseudonym)).toBe(true);
    expect(vistos.has(beto.pseudonym)).toBe(true);
  });

  it('sin includeText no viajan textos escritos por las personas', async () => {
    const salidas = await todasLasSalidas();
    const sensibles = ['HYPERLINK', 'malo.example', 'comillas', 'Qué sigue', 'Respuesta simulada', 'plan provisional'];
    for (const [nombre, contenido] of Object.entries(salidas).filter(([n]) => n.endsWith('-false'))) {
      for (const texto of sensibles) expect(contenido, `${nombre} contiene «${texto}»`).not.toContain(texto);
    }
  });

  it('con includeText=true el texto libre aparece y las fórmulas quedan neutralizadas (CSV)', async () => {
    const res = await s.ana.client.get(`/projects/${s.projectId}/export?format=csv&dataset=agent_interactions&includeText=true`);
    const { rows } = parseCsv(res.body);
    const preguntas = rows.map((r) => r.question!);
    expect(preguntas).toContain("'=HYPERLINK(\"http://malo.example\",\"clic\")"); // fórmula neutralizada
    expect(preguntas).toContain("'@cmd+datos, \"comillas\" y\nsalto de línea");
    expect(preguntas.some((q) => /^[=+\-@]/.test(q))).toBe(false);
  });

  it('el proyecto de ejemplo queda fuera por defecto (409) y con includeSample lleva is_sample = true', async () => {
    await getTestDb().project.update({ where: { id: s.projectId }, data: { isSample: true } });
    expect((await s.ana.client.get(`/projects/${s.projectId}/export?format=json`)).statusCode).toBe(409);
    const conEjemplo = await s.ana.client.get(`/projects/${s.projectId}/export?format=json&includeSample=true`);
    expect(conEjemplo.statusCode).toBe(200);
    expect(conEjemplo.body).toContain('"is_sample": true');
    expect(conEjemplo.body).not.toContain('"is_sample": false');
  });

  it('un Participante recibe 403 en todas las variantes de exportación', async () => {
    for (const query of ['format=json', 'format=csv&dataset=activities', 'format=csv&dataset=agent_interactions&includeText=true']) {
      expect((await beto.client.get(`/projects/${s.projectId}/export?${query}`)).statusCode, query).toBe(403);
    }
  });

  it('un proyecto sin datos de ejemplo ni experimentales adicionales exporta solo su actividad inicial', async () => {
    const vacio = await createScenario(t.app);
    const doc = JSON.parse((await vacio.ana.client.get(`/projects/${vacio.projectId}/export?format=json`)).body) as { datasets: Record<string, unknown[]> };
    expect(doc.datasets.agent_interactions).toEqual([]);
    expect(doc.datasets.exceptions).toEqual([]);
    expect(doc.datasets.activities!.length).toBeGreaterThan(0);
  });
});
