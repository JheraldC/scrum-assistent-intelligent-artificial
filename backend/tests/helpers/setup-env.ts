import path from 'node:path';

// Entorno de las pruebas de integración: base de pruebas independiente e IA simulada.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '..', '.env'));
} catch {
  // Sin .env: se usan las variables del proceso (CI).
}
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ??= 'test-session-secret-test-session-secret-123';
process.env.LLM_PROVIDER = 'fake';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= 'postgresql://scrum:scrum@localhost:5433/scrum_test';
