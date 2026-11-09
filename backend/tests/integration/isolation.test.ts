import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, projectInput, type TestUser } from '../helpers/factories.js';

/**
 * Aislamiento entre proyectos (T028, FR-035, SC-005). Cada historia amplía `routes` con sus
 * rutas `/projects/{id}/...`; la fase final (T135) recorre todas las del contrato.
 */
interface RouteCase {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: (ctx: Ctx) => string;
  body?: (ctx: Ctx) => unknown;
  /** Rol mínimo exigido: con un rol insuficiente se espera 403. */
  facilitatorOnly?: boolean;
}

interface Ctx {
  projectId: string;
  sprintId: string;
  otherUserId: string;
}

const routes: RouteCase[] = [
  { method: 'get', path: (c) => `/projects/${c.projectId}` },
  { method: 'patch', path: (c) => `/projects/${c.projectId}`, body: () => ({ ...projectInput(), expectedVersion: 1 }), facilitatorOnly: true },
  { method: 'get', path: (c) => `/projects/${c.projectId}/members` },
  { method: 'post', path: (c) => `/projects/${c.projectId}/members`, body: () => ({ email: 'x@ejemplo.test', role: 'PARTICIPANT' }), facilitatorOnly: true },
  { method: 'patch', path: (c) => `/projects/${c.projectId}/members/${c.otherUserId}`, body: () => ({ role: 'PARTICIPANT' }), facilitatorOnly: true },
  { method: 'delete', path: (c) => `/projects/${c.projectId}/members/${c.otherUserId}`, facilitatorOnly: true },
  { method: 'get', path: (c) => `/projects/${c.projectId}/sprints` },
  { method: 'post', path: (c) => `/projects/${c.projectId}/sprints`, facilitatorOnly: true },
  { method: 'get', path: (c) => `/projects/${c.projectId}/sprints/${c.sprintId}` },
  { method: 'get', path: (c) => `/projects/${c.projectId}/sprints/${c.sprintId}/stages/PLANNING/evidence` },
  { method: 'post', path: (c) => `/projects/${c.projectId}/sprints/${c.sprintId}/stages/PLANNING/evidence`, body: () => ({ content: 'texto' }) },
  { method: 'get', path: (c) => `/projects/${c.projectId}/activity` },
];

describe('aislamiento entre proyectos (T028)', () => {
  let t: TestApp;
  let ana: TestUser; // Facilitadora del proyecto A
  let beto: TestUser; // Facilitador del proyecto B (ajeno a A)
  let cami: TestUser; // Participante del proyecto A
  let ctx: Ctx;
  let ctxB: Ctx;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    ana = await createUser(t.app, 'ana');
    beto = await createUser(t.app, 'beto');
    cami = await createUser(t.app, 'cami');
    const a = await createProject(ana);
    const b = await createProject(beto);
    await addMember(ana, a.id, cami, 'PARTICIPANT');
    const sa = (await ana.client.post(`/projects/${a.id}/sprints`)).json() as { id: string };
    const sb = (await beto.client.post(`/projects/${b.id}/sprints`)).json() as { id: string };
    ctx = { projectId: a.id, sprintId: sa.id, otherUserId: cami.id };
    ctxB = { projectId: b.id, sprintId: sb.id, otherUserId: beto.id };
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const call = (u: TestUser, r: RouteCase, c: Ctx) => {
    const url = r.path(c);
    if (r.method === 'get') return u.client.get(url);
    if (r.method === 'delete') return u.client.delete(url);
    return u.client[r.method](url, r.body?.(c));
  };

  it.each(routes.map((r) => [`${r.method.toUpperCase()} ${r.path({ projectId: ':projectId', sprintId: ':sprintId', otherUserId: ':userId' })}`, r] as const))(
    'una persona sin membresía recibe 404: %s',
    async (_name, route) => {
      const res = await call(beto, route, ctx); // Beto no pertenece al proyecto A
      expect(res.statusCode).toBe(404);
    },
  );

  it.each(routes.filter((r) => r.facilitatorOnly).map((r) => [`${r.method.toUpperCase()} ${r.path({ projectId: ':projectId', sprintId: ':sprintId', otherUserId: ':userId' })}`, r] as const))(
    'un Participante recibe 403 en una ruta de Facilitador: %s',
    async (_name, route) => {
      const res = await call(cami, route, ctx);
      expect(res.statusCode).toBe(403);
    },
  );

  it('un Sprint de otro proyecto no se alcanza usando el projectId propio (404)', async () => {
    // Beto es miembro de B; pide el Sprint de A bajo su propio proyecto.
    const res = await beto.client.get(`/projects/${ctxB.projectId}/sprints/${ctx.sprintId}`);
    expect(res.statusCode).toBe(404);
    const ev = await beto.client.post(`/projects/${ctxB.projectId}/sprints/${ctx.sprintId}/stages/PLANNING/evidence`, { content: 'intruso' });
    expect(ev.statusCode).toBe(404);
  });

  it('identificadores inexistentes o mal formados devuelven 404', async () => {
    expect((await ana.client.get(`/projects/${randomUUID()}`)).statusCode).toBe(404);
    expect((await ana.client.get('/projects/no-es-uuid')).statusCode).toBe(404);
    expect((await ana.client.get(`/projects/${ctx.projectId}/sprints/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('la lista de proyectos solo contiene los de la persona', async () => {
    const lista = (await beto.client.get('/projects')).json() as { id: string }[];
    expect(lista.map((p) => p.id)).toEqual([ctxB.projectId]);
  });

  it('sin sesión todas las rutas del proyecto responden 401', async () => {
    const { TestClient } = await import('../helpers/client.js');
    const anon = new TestClient(t.app);
    expect((await anon.get(`/projects/${ctx.projectId}`)).statusCode).toBe(401);
    expect((await anon.get(`/projects/${ctx.projectId}/activity`)).statusCode).toBe(401);
  });
});
