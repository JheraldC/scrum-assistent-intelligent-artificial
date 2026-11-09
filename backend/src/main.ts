import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';
import { createDb } from './platform/db.js';

// Carga el .env de la raíz en desarrollo; en producción las variables vienen del entorno.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env: se usan las variables del proceso.
}

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = await buildApp({ config, db });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Cerrando el servidor');
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: '0.0.0.0' });
