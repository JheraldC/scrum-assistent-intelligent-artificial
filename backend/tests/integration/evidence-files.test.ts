import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, getSprint, type Scenario } from '../helpers/scenario.js';

interface Evidence {
  id: string;
  content: string;
  authorPseudonym: string;
  createdAt: string;
  stageType: string;
  attachment: { fileName: string; mimeType: string; sizeBytes: number } | null;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

describe('evidencia de etapa con archivo adjunto opcional', () => {
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

  const url = (stage = 'PLANNING') => `${s.base}/stages/${stage}/evidence`;

  it('la evidencia de texto o enlace sigue funcionando igual y sin adjunto', async () => {
    const res = await s.ana.client.post(url(), { content: 'https://ejemplo.test/acta' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ content: 'https://ejemplo.test/acta', attachment: null, stageType: 'PLANNING' });
  });

  it('un miembro adjunta un archivo: se ve quién, cuándo y a qué etapa corresponde', async () => {
    const res = await beto.client.upload(`${url()}/file`, { name: 'acta.md', data: '# Acta de planning' }, { note: 'Acta de la reunión' });
    expect(res.statusCode, res.body).toBe(201);
    const evidence = res.json() as Evidence;
    expect(evidence).toMatchObject({
      content: 'Acta de la reunión',
      authorPseudonym: beto.pseudonym,
      createdAt: t.clock.now().toISOString(),
      stageType: 'PLANNING',
      attachment: { fileName: 'acta.md', sizeBytes: 18 },
    });
    const list = (await s.ana.client.get(url())).json() as Evidence[];
    expect(list[0]!.attachment).toMatchObject({ fileName: 'acta.md' });
  });

  it('sin nota se usa el nombre del archivo, y el primer registro inicia la etapa', async () => {
    const res = await s.ana.client.upload(`${url()}/file`, { name: 'captura.png', data: PNG });
    expect((res.json() as Evidence).content).toBe('Archivo adjunto: captura.png');
    expect((await getSprint(s)).stages.find((x) => x.type === 'PLANNING')!.status).toBe('IN_PROGRESS');
  });

  it('adjuntar un archivo NO es requisito: planificar y avanzar no lo piden, y adjuntarlo no cambia las compuertas', async () => {
    await s.ana.client.upload(`${url()}/file`, { name: 'extra.txt', data: 'complementario' });
    await fillPlan(s);
    expect(((await evaluatePlan(s)).json() as { status: string }).status).toBe('PASSED');
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
  });

  it('descarga solo para miembros, como adjunto con tipo fijo y los mismos bytes', async () => {
    const evidence = (await s.ana.client.upload(`${url()}/file`, { name: 'captura.png', data: PNG })).json() as Evidence;
    const file = await beto.client.get(`${url()}/${evidence.id}/file`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition']).toMatch(/^attachment;/);
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.rawPayload.equals(PNG)).toBe(true);
    expect((await intruso.client.get(`${url()}/${evidence.id}/file`)).statusCode).toBe(404);
  });

  it('aislamiento: no se descarga con la ruta de otro proyecto, otro Sprint ni otra etapa', async () => {
    const evidence = (await s.ana.client.upload(`${url()}/file`, { name: 'a.txt', data: 'hola' })).json() as Evidence;
    const otro = await createScenario(t.app);
    expect((await otro.ana.client.get(`${otro.base}/stages/PLANNING/evidence/${evidence.id}/file`)).statusCode).toBe(404);
    expect((await s.ana.client.get(`${url('REVIEW')}/${evidence.id}/file`)).statusCode).toBe(404);
  });

  it.each([
    ['ejecutable', 'a.exe', 'MZ'],
    ['HTML', 'a.html', '<html/>'],
    ['imagen falsa', 'a.png', 'no es png'],
    ['vacío', 'a.txt', ''],
  ])('rechaza %s con 422', async (_c, name, content) => {
    expect((await s.ana.client.upload(`${url()}/file`, { name, data: content })).statusCode).toBe(422);
  });

  it('rechaza archivos de más de 5 MB', async () => {
    const res = await s.ana.client.upload(`${url()}/file`, { name: 'grande.txt', data: Buffer.alloc(5 * 1024 * 1024 + 10, 97) });
    expect(res.statusCode).toBe(422);
  });

  it('el seguimiento exige la planificación validada también con archivos, y un Sprint cerrado no los admite', async () => {
    const antes = await s.ana.client.upload(`${url('TRACKING')}/file`, { name: 'a.txt', data: 'x' });
    expect(antes.statusCode).toBe(409);
    expect(antes.json().code).toBe('STAGE_ORDER');
  });

  it('las evidencias de etapa y la documentación permanente son cosas distintas', async () => {
    await s.ana.client.upload(`${url()}/file`, { name: 'acta.md', data: '# Acta' });
    expect(((await s.ana.client.get(`/projects/${s.projectId}/documents`)).json() as unknown[]).length).toBe(0);
  });
});
