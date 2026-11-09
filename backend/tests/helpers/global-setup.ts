import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Aplica las migraciones a la base de pruebas antes de las pruebas de integración. */
export default function setup(): void {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '..', '.env'));
  } catch {
    // Sin .env: se usan las variables del proceso (CI).
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn(
      '[integración] TEST_DATABASE_URL no definida: se omiten las migraciones; las pruebas con base de datos fallarán.',
    );
    return;
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(import.meta.dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: true,
  });
}
