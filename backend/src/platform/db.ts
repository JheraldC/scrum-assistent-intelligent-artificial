import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Crea el cliente de Prisma (único por proceso) con el adaptador de PostgreSQL. */
export function createDb(databaseUrl: string): Db {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

/**
 * Presenta una transacción ya abierta como un `Db` para reutilizar un servicio que abre su propia
 * transacción (`withTransaction`) DENTRO de otra: así «aplicar una sugerencia» y el cambio del artefacto
 * ocurren de forma atómica y con el mismo control de versión que la edición manual.
 */
export function joinTransaction(tx: Tx): Db {
  return { $transaction: <T>(fn: (inner: Tx) => Promise<T>) => fn(tx) } as unknown as Db;
}

/** Ejecuta `fn` en una transacción interactiva (operaciones críticas, data-model.md). */
export function withTransaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction((tx) => fn(tx), { timeout: 15_000 });
}
