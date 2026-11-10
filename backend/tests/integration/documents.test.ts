import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { createScenario, type Scenario } from '../helpers/scenario.js';

interface Doc {
  id: string;
  name: string;
  status: string;
  includeInContext: boolean;
  currentVersion: number;
  current: { fileName: string; mimeType: string; sizeBytes: number; usableAsContext: boolean; uploadedByPseudonym: string };
}

const REQUISITOS = '# Requisitos\nEl sistema registra la asistencia.\n\n## Reglas del negocio\nUna falta se justifica con certificado en 48 horas.';
const PDF = Buffer.from('%PDF-1.4\nfalso pero con firma\n');

describe('documentación permanente del proyecto', () => {
  let t: TestApp;
  let s: Scenario;
  let beto: TestUser;
  let intruso: TestUser;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    s = await createScenario(t.app);
    beto = await createUser(t.app, 'beto');
    await addMember(s.ana, s.projectId, beto, 'PARTICIPANT');
    intruso = await createUser(t.app, 'intruso');
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const base = () => `/projects/${s.projectId}/documents`;
  const subir = (name: string, data: Buffer | string, fields: Record<string, string> = {}, user = s.ana) => user.client.upload(base(), { name, data }, fields);

  it('es opcional: sin documentos el proyecto funciona y la lista está vacía', async () => {
    const res = await s.ana.client.get(base());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect((await s.ana.client.get(`/projects/${s.projectId}`)).statusCode).toBe(200);
  });

  it('el Facilitador sube un documento de texto: queda activo y listo para el contexto de la IA', async () => {
    const res = await subir('requisitos.md', REQUISITOS, { name: 'Requisitos del sistema' });
    expect(res.statusCode, res.body).toBe(201);
    const doc = res.json() as Doc;
    expect(doc).toMatchObject({ name: 'Requisitos del sistema', status: 'ACTIVE', includeInContext: true, currentVersion: 1 });
    expect(doc.current).toMatchObject({ fileName: 'requisitos.md', usableAsContext: true, uploadedByPseudonym: s.ana.pseudonym });
  });

  it('un PDF se guarda como referencia: no se usa como contexto de IA (no se extrae su texto)', async () => {
    const doc = (await subir('arquitectura.pdf', PDF)).json() as Doc;
    expect(doc).toMatchObject({ includeInContext: false });
    expect(doc.current.usableAsContext).toBe(false);
    const forced = await s.ana.client.patch(`${base()}/${doc.id}`, { includeInContext: true });
    expect(forced.statusCode).toBe(422);
  });

  it('solo el Facilitador sube, reemplaza o cambia documentos (403); cualquier miembro los consulta y descarga', async () => {
    const doc = (await subir('a.md', REQUISITOS)).json() as Doc;
    expect((await subir('b.md', REQUISITOS, {}, beto)).statusCode).toBe(403);
    expect((await beto.client.upload(`${base()}/${doc.id}/versions`, { name: 'c.md', data: 'x' })).statusCode).toBe(403);
    expect((await beto.client.patch(`${base()}/${doc.id}`, { status: 'OUTDATED' })).statusCode).toBe(403);
    expect(((await beto.client.get(base())).json() as Doc[]).length).toBe(1);
    expect((await beto.client.get(`${base()}/${doc.id}/file`)).statusCode).toBe(200);
  });

  it('aislamiento: un ajeno no ve, descarga ni modifica documentos (404) y no se mezclan proyectos', async () => {
    const doc = (await subir('a.md', REQUISITOS)).json() as Doc;
    expect((await intruso.client.get(base())).statusCode).toBe(404);
    expect((await intruso.client.get(`${base()}/${doc.id}/file`)).statusCode).toBe(404);
    expect((await intruso.client.upload(base(), { name: 'x.md', data: 'x' })).statusCode).toBe(404);
    const otro = await createScenario(t.app);
    expect((await otro.ana.client.get(`/projects/${otro.projectId}/documents/${doc.id}/file`)).statusCode).toBe(404);
    expect((await otro.ana.client.patch(`/projects/${otro.projectId}/documents/${doc.id}`, { status: 'OUTDATED' })).statusCode).toBe(404);
    expect(((await otro.ana.client.get(`/projects/${otro.projectId}/documents`)).json() as Doc[]).length).toBe(0);
  });

  it('reemplazar crea una versión nueva, conserva las anteriores y reactiva el documento', async () => {
    const doc = (await subir('a.md', REQUISITOS)).json() as Doc;
    await s.ana.client.patch(`${base()}/${doc.id}`, { status: 'OUTDATED' });
    const v2 = await s.ana.client.upload(`${base()}/${doc.id}/versions`, { name: 'a-v2.md', data: '# Nuevo\nContenido actualizado' });
    expect(v2.statusCode, v2.body).toBe(201);
    expect(v2.json()).toMatchObject({ currentVersion: 2, status: 'ACTIVE' });
    const versions = (await s.ana.client.get(`${base()}/${doc.id}/versions`)).json() as { version: number; fileName: string }[];
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    const old = await s.ana.client.get(`${base()}/${doc.id}/file?version=1`);
    expect(old.body).toContain('Reglas del negocio');
    const current = await s.ana.client.get(`${base()}/${doc.id}/file`);
    expect(current.body).toContain('Contenido actualizado');
    expect((await s.ana.client.get(`${base()}/${doc.id}/file?version=9`)).statusCode).toBe(404);
  });

  it('se marca como desactualizado y se controla si entra al contexto', async () => {
    const doc = (await subir('a.md', REQUISITOS)).json() as Doc;
    const outdated = await s.ana.client.patch(`${base()}/${doc.id}`, { status: 'OUTDATED' });
    expect(outdated.json()).toMatchObject({ status: 'OUTDATED' });
    const off = await s.ana.client.patch(`${base()}/${doc.id}`, { includeInContext: false, name: 'Renombrado' });
    expect(off.json()).toMatchObject({ includeInContext: false, name: 'Renombrado' });
    expect((await s.ana.client.patch(`${base()}/${doc.id}`, {})).statusCode).toBe(422);
    expect((await s.ana.client.patch(`${base()}/${doc.id}`, { status: 'BORRADO' })).statusCode).toBe(422);
  });

  it('la descarga es siempre un adjunto con tipo fijo y sin sniffing', async () => {
    const doc = (await subir('a.md', '# <script>alert(1)</script>')).json() as Doc;
    const res = await s.ana.client.get(`${base()}/${doc.id}/file`);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it.each([
    ['ejecutable', 'virus.exe', 'MZ...'],
    ['HTML', 'pagina.html', '<html></html>'],
    ['SVG', 'img.svg', '<svg/>'],
    ['PDF falso', 'falso.pdf', 'esto no es un pdf'],
    ['vacío', 'vacio.txt', ''],
    ['sin extensión', 'LEEME', 'texto'],
  ])('rechaza %s con 422', async (_c, name, content) => {
    expect((await subir(name, content)).statusCode).toBe(422);
  });

  it('rechaza archivos de más de 2 MB y sin archivo', async () => {
    const big = await subir('grande.txt', Buffer.alloc(2 * 1024 * 1024 + 10, 97));
    expect(big.statusCode).toBe(422);
    expect(big.json().message).toMatch(/tamaño/);
    const none = await s.ana.client.post(base(), {});
    expect([415, 422]).toContain(none.statusCode);
  });

  it('exige el token CSRF para subir', async () => {
    const res = await s.ana.client.upload(base(), { name: 'a.md', data: 'x' }, {}, { csrf: false });
    expect(res.statusCode).toBe(403);
  });

  it('limita a 30 documentos por proyecto', async () => {
    for (let i = 0; i < 30; i += 1) expect((await subir(`d${i}.txt`, `contenido ${i}`)).statusCode).toBe(201);
    expect((await subir('uno-mas.txt', 'x')).statusCode).toBe(409);
  });
});
