import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Carga el .env de la raíz si existe (TEST_DATABASE_URL, etc.).
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '.env'));
} catch {
  // Sin .env: se usan las variables del proceso (CI).
}

// PW_CHANNEL=msedge|chrome permite usar un navegador ya instalado sin descargar binarios de Playwright.
const channel = process.env.PW_CHANNEL || undefined;

// Las pruebas e2e usan sus propios puertos para no chocar con (ni usar) el servidor de desarrollo.
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5273);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
process.env.E2E_BASE_URL = `http://localhost:${WEB_PORT}`;

// Las pruebas funcionales levantan el backend y el frontend reales con la IA simulada
// (LLM_PROVIDER=fake). Los datos simulados nunca son evidencia experimental (Principio V).
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    locale: 'es',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'movil', use: { ...devices['Pixel 7'], channel }, grep: /@movil/ },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: `http://localhost:${WEB_PORT}`,
    // Nunca se reutiliza un servidor ya abierto (podría ser el de desarrollo, con la IA real y la base de desarrollo).
    // Si el puerto está ocupado, Playwright falla en lugar de usarlo; PW_REUSE_SERVER=1 lo permite a propósito.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      PORT: String(API_PORT),
      API_PORT: String(API_PORT),
      WEB_PORT: String(WEB_PORT),
      LLM_PROVIDER: 'fake',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-e2e-session-secret-12',
    },
  },
});
