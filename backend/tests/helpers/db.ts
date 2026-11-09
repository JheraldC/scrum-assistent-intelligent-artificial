import { createDb, type Db } from '../../src/platform/db.js';

let db: Db | undefined;

/** Cliente de la base de pruebas (TEST_DATABASE_URL). Requiere migraciones ya aplicadas. */
export function getTestDb(): Db {
  if (!db) db = createDb(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
  return db;
}

/** Vacía todas las tablas de negocio entre pruebas (conserva el historial de migraciones). */
export async function resetDb(): Promise<void> {
  const client = getTestDb();
  const rows = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await client.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

export async function closeTestDb(): Promise<void> {
  if (db) await db.$disconnect();
  db = undefined;
}
