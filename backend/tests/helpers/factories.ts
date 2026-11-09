import type { FastifyInstance } from 'fastify';
import { TestClient } from './client.js';

// Fábricas de datos de prueba. Cada historia añade las suyas.
let counter = 0;

export function nextId(prefix = 'x'): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export function uniqueEmail(prefix = 'persona'): string {
  return `${prefix}.${nextId()}@ejemplo.test`;
}

export const PASSWORD = 'una-clave-segura-123';

export interface TestUser {
  client: TestClient;
  id: string;
  email: string;
  pseudonym: string;
}

/** Registra una cuenta nueva e inicia sesión con un cliente propio. */
export async function createUser(app: FastifyInstance, prefix = 'persona'): Promise<TestUser> {
  const client = new TestClient(app);
  const email = uniqueEmail(prefix);
  const reg = await client.post('/auth/register', { email, password: PASSWORD });
  if (reg.statusCode !== 201) throw new Error(`No se pudo registrar: ${reg.body}`);
  const me = reg.json() as { id: string; pseudonym: string };
  const login = await client.login(email, PASSWORD);
  if (login.statusCode !== 200) throw new Error(`No se pudo iniciar sesión: ${login.body}`);
  return { client, id: me.id, email, pseudonym: me.pseudonym };
}

export const projectInput = (overrides: Record<string, unknown> = {}) => ({
  name: `Proyecto ${nextId('p')}`,
  description: 'Proyecto de prueba',
  productGoal: 'Un objetivo de producto de prueba',
  ...overrides,
});

export async function createProject(owner: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await owner.client.post('/projects', projectInput(overrides));
  if (res.statusCode !== 201) throw new Error(`No se pudo crear el proyecto: ${res.body}`);
  return res.json() as { id: string; name: string; version: number };
}

export async function addMember(owner: TestUser, projectId: string, member: TestUser, role: 'PARTICIPANT' | 'FACILITATOR') {
  const res = await owner.client.post(`/projects/${projectId}/members`, { email: member.email, role });
  if (res.statusCode !== 201) throw new Error(`No se pudo agregar al miembro: ${res.body}`);
}
