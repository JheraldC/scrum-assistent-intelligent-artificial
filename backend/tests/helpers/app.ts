import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig, type Config } from '../../src/platform/config.js';
import { TestClock } from '../../src/platform/clock.js';
import { FakeLlmProvider } from '../../src/modules/agent/llm/index.js';
import { getTestDb } from './db.js';

export interface TestApp {
  app: FastifyInstance;
  clock: TestClock;
  config: Config;
  llm: FakeLlmProvider;
}

/**
 * App de pruebas: reloj controlable, IA simulada y base de pruebas.
 * `beforeReady` permite registrar rutas auxiliares de prueba antes de `ready()`.
 */
export async function buildTestApp(
  overrides: Partial<NodeJS.ProcessEnv> = {},
  beforeReady?: (app: FastifyInstance) => void | Promise<void>,
): Promise<TestApp> {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', LLM_PROVIDER: 'fake', ...overrides });
  const clock = new TestClock();
  const llm = new FakeLlmProvider();
  const app = await buildApp({ config, db: getTestDb(), clock, llm });
  if (beforeReady) await beforeReady(app);
  await app.ready();
  return { app, clock, config, llm };
}
