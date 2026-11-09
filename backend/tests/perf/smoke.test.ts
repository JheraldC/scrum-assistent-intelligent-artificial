import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { createProject, createUser, type TestUser } from '../helpers/factories.js';
import { historiaBuena } from '../helpers/scenario.js';

/**
 * Prueba de rendimiento de humo (T143): ~50 sesiones concurrentes sobre la aplicación en proceso
 * (`inject`, sin red). Metas de plan.md: p95 < 500 ms sin IA y evaluación de compuerta < 1 s.
 * Es una señal de regresión, no una medición de capacidad del hosting.
 */
const SESSIONS = 50;

const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]!;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: performance.now() - start, value };
}

describe('rendimiento de humo (T143)', () => {
  let t: TestApp;
  let users: { user: TestUser; projectId: string; storyId: string }[];

  beforeAll(async () => {
    t = await buildTestApp();
    await resetDb();
    users = [];
    // Las altas (Argon2) se hacen por tandas para no saturar el procesador antes de medir.
    for (let i = 0; i < SESSIONS; i += 10) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(10, SESSIONS - i) }, async () => {
          const user = await createUser(t.app, 'perf');
          const project = await createProject(user);
          const story = (await user.client.post(`/projects/${project.id}/backlog`, historiaBuena)).json() as { id: string };
          return { user, projectId: project.id, storyId: story.id };
        }),
      );
      users.push(...batch);
    }
  }, 120_000);

  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it(`${SESSIONS} sesiones concurrentes: p95 < 500 ms en lecturas y escrituras sin IA`, async () => {
    const results = await Promise.all(
      users.map(async ({ user, projectId }) => {
        const calls = [
          () => user.client.get('/projects'),
          () => user.client.get(`/projects/${projectId}`),
          () => user.client.get(`/projects/${projectId}/backlog`),
          () => user.client.get(`/projects/${projectId}/activity`),
          () => user.client.post(`/projects/${projectId}/sprints`),
        ];
        const times: number[] = [];
        for (const call of calls) {
          const { ms, value } = await timed(call);
          expect(value.statusCode).toBeLessThan(300);
          times.push(ms);
        }
        return times;
      }),
    );
    expect(p95(results.flat())).toBeLessThan(500);
  });

  it(`${SESSIONS} evaluaciones de compuerta simultáneas: p95 < 1 s`, async () => {
    const times = await Promise.all(
      users.map(async ({ user, projectId, storyId }) => {
        const { ms, value } = await timed(() =>
          user.client.post(`/projects/${projectId}/validations`, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: storyId }),
        );
        expect(value.statusCode).toBe(201);
        return ms;
      }),
    );
    expect(p95(times)).toBeLessThan(1000);
  });
});
