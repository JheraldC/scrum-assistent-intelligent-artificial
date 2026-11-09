import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { TestClient } from '../helpers/client.js';
import { PASSWORD } from '../helpers/factories.js';
import { createScenario, evaluatePlan, fillPlan, type Scenario } from '../helpers/scenario.js';

/** Persistencia (T138, FR-034, SC-004): reiniciar la aplicación no pierde datos y las migraciones están completas. */
describe('persistencia tras reiniciar la aplicación (T138)', () => {
  let first: TestApp;
  let s: Scenario;

  beforeEach(async () => {
    first = await buildTestApp();
    await resetDb();
    s = await createScenario(first.app);
  });
  afterAll(async () => {
    await first.app.close().catch(() => undefined);
    await closeTestDb();
  });

  it('proyectos, artefactos, evaluaciones e interacciones sobreviven a un reinicio', async () => {
    await fillPlan(s);
    const run = (await evaluatePlan(s)).json() as { id: string };
    await s.ana.client.post(`/projects/${s.projectId}/agent/chat`, { message: '¿Qué le falta a mi plan?' });
    await first.app.close();

    // «Reinicio»: una instancia nueva sobre la misma base; la sesión (cookie) sigue siendo válida.
    const second = await buildTestApp();
    try {
      const client = new TestClient(second.app);
      for (const [k, v] of s.ana.client.cookies) client.cookies.set(k, v);
      const project = await client.get(`/projects/${s.projectId}`);
      expect(project.statusCode).toBe(200);
      const sprint = await client.get(s.base);
      expect((sprint.json() as { sprintGoal: string }).sprintGoal).toContain('asistencia');
      expect((await client.get(`/projects/${s.projectId}/validations/${run.id}`)).statusCode).toBe(200);
      expect(((await client.get(`/projects/${s.projectId}/agent/interactions`)).json() as unknown[]).length).toBeGreaterThan(0);
      // Y la cuenta puede volver a entrar con su contraseña.
      const again = new TestClient(second.app);
      expect((await again.login(s.ana.email, PASSWORD)).statusCode).toBe(200);
    } finally {
      await second.app.close();
    }
  });

  it('todas las migraciones están aplicadas y la base tiene las tablas del modelo de datos', async () => {
    const db = getTestDb();
    const tables = (await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((t) => t.tablename);
    for (const name of ['user', 'session', 'project', 'project_member', 'sprint', 'sprint_stage', 'evidence', 'activity_log', 'backlog_item', 'validation_run', 'criterion_result', 'sprint_item', 'gate_exception', 'agent_interaction', 'retrospective', 'retro_action', 'tracking_entry', 'sprint_review']) {
      expect(tables, name).toContain(name);
    }
    const pending = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NULL`;
    expect(Number(pending[0]!.n)).toBe(0);
  });
});
