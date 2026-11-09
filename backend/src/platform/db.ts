import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Crea el cliente de Prisma (único por proceso) con el adaptador de PostgreSQL. */
export function createDb(databaseUrl: string): Db {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

/** Ejecuta `fn` en una transacción interactiva (operaciones críticas, data-model.md). */
export function withTransaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction((tx) => fn(tx), { timeout: 15_000 });
}
