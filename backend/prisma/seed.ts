import path from 'node:path';
import { createDb } from '../src/platform/db.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { generatePseudonym } from '../src/modules/auth/pseudonym.js';

// Sembrado SOLO de desarrollo: un proyecto de ejemplo marcado `is_sample = true` (FR-030) y dos
// cuentas de demostración. Nunca se ejecuta en producción ni genera datos experimentales.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '.env'));
} catch {
  // Sin .env: se usan las variables del proceso.
}

if (process.env.NODE_ENV === 'production') {
  console.error('El sembrado de datos de ejemplo está prohibido en producción.');
  process.exit(1);
}

const DEMO_PASSWORD = 'demo-clave-segura-2026'; // solo para cuentas de demostración locales
const db = createDb(process.env.DATABASE_URL ?? '');

async function ensureUser(email: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({
    data: { email, passwordHash: await hashPassword(DEMO_PASSWORD), pseudonym: generatePseudonym() },
  });
}

const facilitator = await ensureUser('demo.facilitador@ejemplo.test');
const participant = await ensureUser('demo.participante@ejemplo.test');

const already = await db.project.findFirst({ where: { isSample: true } });
if (already) {
  console.log('El proyecto de ejemplo ya existe; no se hace nada.');
} else {
  const now = new Date();
  const project = await db.project.create({
    data: {
      name: 'Proyecto de ejemplo (DATOS DE DEMOSTRACIÓN)',
      description: 'Proyecto de demostración sembrado para mostrar la herramienta. No es un dato experimental.',
      productGoal: 'Mostrar el flujo guiado de Scrum con un equipo ficticio',
      isSample: true,
      createdBy: facilitator.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  await db.projectMember.createMany({
    data: [
      { projectId: project.id, userId: facilitator.id, role: 'FACILITATOR' },
      { projectId: project.id, userId: participant.id, role: 'PARTICIPANT' },
    ],
  });
  await db.sprint.create({
    data: {
      projectId: project.id,
      number: 1,
      stages: { create: (['PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE'] as const).map((type) => ({ type })) },
    },
  });
  console.log('Proyecto de ejemplo creado (is_sample = true).');
}

await db.$disconnect();
