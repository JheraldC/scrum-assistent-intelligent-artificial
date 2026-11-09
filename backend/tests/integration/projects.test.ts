import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, projectInput, uniqueEmail } from '../helpers/factories.js';

describe('proyectos, roles y miembros (T027, FR-002, FR-003, FR-036)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(resetDb);
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('cualquier persona con cuenta crea un proyecto y queda como Facilitador', async () => {
    const ana = await createUser(t.app);
    const res = await ana.client.post('/projects', projectInput({ name: 'Mi proyecto' }));
    expect(res.statusCode).toBe(201);
    const list = (await ana.client.get('/projects')).json() as { name: string; myRole: string; status: string }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Mi proyecto', myRole: 'FACILITATOR', status: 'SIN_SPRINT' });
  });

  it.each([
    ['nombre vacío', { name: '' }],
    ['nombre de 2 caracteres', { name: 'ab' }],
    ['nombre de 101 caracteres', { name: 'x'.repeat(101) }],
    ['objetivo vacío', { productGoal: '' }],
    ['objetivo de 501 caracteres', { productGoal: 'y'.repeat(501) }],
    ['descripción de 1001 caracteres', { description: 'z'.repeat(1001) }],
  ])('rechaza %s con 422 en español', async (_caso, overrides) => {
    const ana = await createUser(t.app);
    const res = await ana.client.post('/projects', projectInput(overrides));
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('exige sesión para crear o listar proyectos', async () => {
    const anon = new (await import('../helpers/client.js')).TestClient(t.app);
    expect((await anon.get('/projects')).statusCode).toBe(401);
  });

  it('una misma persona tiene roles distintos en dos proyectos y cada rol aplica solo en el suyo', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const proyectoA = await createProject(ana);
    const proyectoB = await createProject(beto);
    await addMember(ana, proyectoA.id, beto, 'PARTICIPANT');
    await addMember(beto, proyectoB.id, ana, 'FACILITATOR');

    // Beto es Participante en A: no puede editar ni gestionar miembros allí.
    const edit = await beto.client.patch(`/projects/${proyectoA.id}`, { ...projectInput(), expectedVersion: 1 });
    expect(edit.statusCode).toBe(403);
    const add = await beto.client.post(`/projects/${proyectoA.id}/members`, { email: ana.email, role: 'PARTICIPANT' });
    expect(add.statusCode).toBe(403);
    // Pero es Facilitador en B.
    const editB = await beto.client.patch(`/projects/${proyectoB.id}`, { ...projectInput({ name: 'Nuevo nombre' }), expectedVersion: 1 });
    expect(editB.statusCode).toBe(200);

    const rolesBeto = (await beto.client.get('/projects')).json() as { id: string; myRole: string }[];
    expect(rolesBeto.find((p) => p.id === proyectoA.id)?.myRole).toBe('PARTICIPANT');
    expect(rolesBeto.find((p) => p.id === proyectoB.id)?.myRole).toBe('FACILITATOR');
  });

  it('solo el Facilitador ve el correo de los miembros; los demás ven solo el seudónimo', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const p = await createProject(ana);
    await addMember(ana, p.id, beto, 'PARTICIPANT');
    const comoFacilitador = (await ana.client.get(`/projects/${p.id}/members`)).json() as Record<string, string>[];
    expect(comoFacilitador.every((m) => typeof m.email === 'string')).toBe(true);
    const comoParticipante = (await beto.client.get(`/projects/${p.id}/members`)).json() as Record<string, string>[];
    expect(comoParticipante.every((m) => m.email === undefined && /^P-/.test(m.pseudonym!))).toBe(true);
  });

  it('agregar un correo sin cuenta responde 404 pidiendo que se registre primero', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const res = await ana.client.post(`/projects/${p.id}/members`, { email: uniqueEmail('nadie'), role: 'PARTICIPANT' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe('La persona debe registrarse primero.');
  });

  it('agregar dos veces a la misma persona responde 409', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const p = await createProject(ana);
    await addMember(ana, p.id, beto, 'PARTICIPANT');
    const again = await ana.client.post(`/projects/${p.id}/members`, { email: beto.email, role: 'PARTICIPANT' });
    expect(again.statusCode).toBe(409);
  });

  it('no se puede degradar ni quitar al último Facilitador (409 LAST_FACILITATOR)', async () => {
    const ana = await createUser(t.app, 'ana');
    const p = await createProject(ana);
    const demote = await ana.client.patch(`/projects/${p.id}/members/${ana.id}`, { role: 'PARTICIPANT' });
    expect(demote.statusCode).toBe(409);
    expect(demote.json().code).toBe('LAST_FACILITATOR');
    const remove = await ana.client.delete(`/projects/${p.id}/members/${ana.id}`);
    expect(remove.statusCode).toBe(409);
    expect(remove.json().code).toBe('LAST_FACILITATOR');
  });

  it('con dos Facilitadores, degradaciones simultáneas cruzadas dejan siempre uno', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const p = await createProject(ana);
    await addMember(ana, p.id, beto, 'FACILITATOR');
    const [r1, r2] = await Promise.all([
      ana.client.patch(`/projects/${p.id}/members/${beto.id}`, { role: 'PARTICIPANT' }),
      beto.client.patch(`/projects/${p.id}/members/${ana.id}`, { role: 'PARTICIPANT' }),
    ]);
    // Exactamente una degradación prospera. La otra se rechaza con 409 (regla del último
    // Facilitador, bajo bloqueo) o con 403 (si ya perdió el rol antes de ejecutarse).
    const statuses = [r1.statusCode, r2.statusCode].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    const miembros = (await (ana.client.get(`/projects/${p.id}/members`).then((r) => (r.statusCode === 200 ? r : beto.client.get(`/projects/${p.id}/members`))))).json() as { role: string }[];
    expect(miembros.filter((m) => m.role === 'FACILITATOR')).toHaveLength(1);
  });

  it('quitar a un miembro le retira el acceso (404)', async () => {
    const ana = await createUser(t.app, 'ana');
    const beto = await createUser(t.app, 'beto');
    const p = await createProject(ana);
    await addMember(ana, p.id, beto, 'PARTICIPANT');
    expect((await beto.client.get(`/projects/${p.id}`)).statusCode).toBe(200);
    expect((await ana.client.delete(`/projects/${p.id}/members/${beto.id}`)).statusCode).toBe(204);
    expect((await beto.client.get(`/projects/${p.id}`)).statusCode).toBe(404);
  });

  it('editar el proyecto con versión desactualizada devuelve 409 con el estado actual (FR-036)', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const ok = await ana.client.patch(`/projects/${p.id}`, { ...projectInput({ name: 'Versión dos' }), expectedVersion: 1 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().version).toBe(2);
    const stale = await ana.client.patch(`/projects/${p.id}`, { ...projectInput({ name: 'Versión tardía' }), expectedVersion: 1 });
    expect(stale.statusCode).toBe(409);
    const body = stale.json();
    expect(body.code).toBe('VERSION_CONFLICT');
    expect(body.current.name).toBe('Versión dos');
  });

  it('dos ediciones simultáneas con la misma versión: una gana y la otra recibe 409', async () => {
    const ana = await createUser(t.app);
    const p = await createProject(ana);
    const [a, b] = await Promise.all([
      ana.client.patch(`/projects/${p.id}`, { ...projectInput({ name: 'Edición A' }), expectedVersion: 1 }),
      ana.client.patch(`/projects/${p.id}`, { ...projectInput({ name: 'Edición B' }), expectedVersion: 1 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });
});
