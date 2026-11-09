import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, type TestUser } from '../helpers/factories.js';

const historia = (overrides: Record<string, unknown> = {}) => ({
  kind: 'USER_STORY',
  title: 'Registrar asistencia',
  asA: 'Scrum Master',
  iWant: 'registrar la asistencia diaria del equipo',
  soThat: 'puedo detectar ausencias recurrentes',
  acceptanceCriteria: ['Se guarda la fecha y la hora del registro'],
  priority: 1,
  ...overrides,
});

describe('Product Backlog (T054, FR-008, FR-036)', () => {
  let t: TestApp;
  let ana: TestUser;
  let projectId: string;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    ana = await createUser(t.app, 'ana');
    projectId = (await createProject(ana)).id;
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('crea historias con código HU-n y elementos con código EL-n por proyecto', async () => {
    const h1 = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    const h2 = (await ana.client.post(`/projects/${projectId}/backlog`, historia({ title: 'Otra', priority: 2 }))).json();
    const e1 = (
      await ana.client.post(`/projects/${projectId}/backlog`, {
        kind: 'ITEM',
        title: 'Preparar entorno',
        description: 'Configurar el entorno de pruebas',
        priority: 3,
      })
    ).json();
    expect([h1.code, h2.code, e1.code]).toEqual(['HU-1', 'HU-2', 'EL-1']);
    expect(h1.version).toBe(1);
    expect(h1.gateState).toBe('NO_EVALUADA');
  });

  it('el código es único por proyecto: otro proyecto vuelve a empezar en HU-1', async () => {
    await ana.client.post(`/projects/${projectId}/backlog`, historia());
    const otro = await createProject(ana);
    const res = await ana.client.post(`/projects/${otro.id}/backlog`, historia());
    expect(res.json().code).toBe('HU-1');
  });

  it('lista el backlog ordenado por prioridad', async () => {
    await ana.client.post(`/projects/${projectId}/backlog`, historia({ title: 'C', priority: 3 }));
    await ana.client.post(`/projects/${projectId}/backlog`, historia({ title: 'A', priority: 1 }));
    await ana.client.post(`/projects/${projectId}/backlog`, historia({ title: 'B', priority: 2 }));
    const lista = (await ana.client.get(`/projects/${projectId}/backlog`)).json() as { title: string }[];
    expect(lista.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('una historia incompleta se puede guardar (la compuerta la señalará), con campos vacíos', async () => {
    const res = await ana.client.post(`/projects/${projectId}/backlog`, { kind: 'USER_STORY', title: 'Idea suelta', priority: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ asA: '', iWant: '', soThat: '', acceptanceCriteria: [] });
  });

  it('cualquier miembro (también Participante) crea y edita elementos', async () => {
    const beto = await createUser(t.app, 'beto');
    await addMember(ana, projectId, beto, 'PARTICIPANT');
    const creado = await beto.client.post(`/projects/${projectId}/backlog`, historia());
    expect(creado.statusCode).toBe(201);
    const editado = await beto.client.patch(`/projects/${projectId}/backlog/${creado.json().id}`, { ...historia({ title: 'Editada por Beto' }), expectedVersion: 1 });
    expect(editado.statusCode).toBe(200);
  });

  it.each([
    ['título vacío', { title: '' }],
    ['título de 121 caracteres', { title: 'x'.repeat(121) }],
    ['necesidad de 501 caracteres', { iWant: 'y'.repeat(501) }],
    ['rol de 201 caracteres', { asA: 'z'.repeat(201) }],
    ['21 criterios de aceptación', { acceptanceCriteria: Array.from({ length: 21 }, (_, i) => `criterio ${i}`) }],
    ['criterio de 301 caracteres', { acceptanceCriteria: ['c'.repeat(301)] }],
    ['prioridad 0', { priority: 0 }],
    ['prioridad no entera', { priority: 1.5 }],
    ['tipo desconocido', { kind: 'EPICA' }],
  ])('rechaza %s con 422', async (_caso, overrides) => {
    const res = await ana.client.post(`/projects/${projectId}/backlog`, historia(overrides));
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('acepta 20 criterios de aceptación y un título de 120 caracteres (límites)', async () => {
    const res = await ana.client.post(
      `/projects/${projectId}/backlog`,
      historia({ title: 'x'.repeat(120), acceptanceCriteria: Array.from({ length: 20 }, () => 'c'.repeat(300)) }),
    );
    expect(res.statusCode).toBe(201);
  });

  it('editar con la versión vigente incrementa la versión', async () => {
    const h = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    const res = await ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'Nuevo título' }), expectedVersion: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'Nuevo título', version: 2 });
  });

  it('editar con versión desactualizada devuelve 409 con el estado actual (FR-036)', async () => {
    const h = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    await ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'Versión dos' }), expectedVersion: 1 });
    const stale = await ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'Tardía' }), expectedVersion: 1 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe('VERSION_CONFLICT');
    expect(stale.json().current.title).toBe('Versión dos');
    expect(stale.json().current.version).toBe(2);
  });

  it('dos PATCH simultáneos con la misma versión: uno gana y el otro recibe 409', async () => {
    const h = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    const [a, b] = await Promise.all([
      ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'A' }), expectedVersion: 1 }),
      ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'B' }), expectedVersion: 1 }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });

  it('editar sin expectedVersion es un error de validación', async () => {
    const h = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    const res = await ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, historia());
    expect(res.statusCode).toBe(422);
  });

  it('un elemento de otro proyecto no es accesible desde el propio (404)', async () => {
    const beto = await createUser(t.app, 'beto');
    const pb = await createProject(beto);
    const ajeno = (await beto.client.post(`/projects/${pb.id}/backlog`, historia())).json();
    expect((await ana.client.get(`/projects/${projectId}/backlog/${ajeno.id}`)).statusCode).toBe(404);
    expect((await ana.client.patch(`/projects/${projectId}/backlog/${ajeno.id}`, { ...historia(), expectedVersion: 1 })).statusCode).toBe(404);
    expect((await ana.client.get(`/projects/${projectId}/backlog/${randomUUID()}`)).statusCode).toBe(404);
  });

  it('la actividad registra la creación y la edición sin contenido personal', async () => {
    const h = (await ana.client.post(`/projects/${projectId}/backlog`, historia())).json();
    await ana.client.patch(`/projects/${projectId}/backlog/${h.id}`, { ...historia({ title: 'Otra' }), expectedVersion: 1 });
    const acciones = ((await ana.client.get(`/projects/${projectId}/activity`)).json() as { action: string }[]).map((a) => a.action);
    expect(acciones).toEqual(expect.arrayContaining(['backlog_item.created', 'backlog_item.updated']));
  });
});
