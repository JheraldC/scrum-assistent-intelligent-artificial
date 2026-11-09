import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Carga el .env de la raíz del repositorio si existe (Prisma 7 ya no lo carga solo).
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '.env'));
} catch {
  // Sin .env: se usan las variables de entorno del proceso (CI, producción).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
