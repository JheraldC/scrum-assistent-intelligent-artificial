import { Prisma } from '../../../generated/prisma/client.js';
import type { Db } from '../../platform/db.js';

export function findUserByEmail(db: Db, email: string) {
  return db.user.findUnique({ where: { email } });
}

export type CreateUserResult =
  | { ok: true; user: { id: string; email: string; pseudonym: string } }
  | { ok: false; reason: 'email-taken' | 'pseudonym-taken' };

/** Crea la cuenta; traduce las violaciones de unicidad (P2002) a un resultado tipado. */
export async function createUser(
  db: Db,
  data: { email: string; passwordHash: string; pseudonym: string; createdAt: Date },
): Promise<CreateUserResult> {
  try {
    const user = await db.user.create({ data });
    return { ok: true, user: { id: user.id, email: user.email, pseudonym: user.pseudonym } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = JSON.stringify(error.meta ?? {});
      return { ok: false, reason: target.includes('pseudonym') ? 'pseudonym-taken' : 'email-taken' };
    }
    throw error;
  }
}
