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

// Las pruebas funcionales levantan el backend y el frontend reales con la IA simulada
// (LLM_PROVIDER=fake). Los datos simulados nunca son evidencia experimental (Principio V).
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
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
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LLM_PROVIDER: 'fake',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-e2e-session-secret-12',
    },
  },
});
