import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createUser, type TestUser } from '../helpers/factories.js';
import { completeStage, createScenario, evaluatePlan, fillPlan, type Scenario } from '../helpers/scenario.js';

interface Evidence {
  id: string;
  content: string;
  authorPseudonym: string;
  createdAt: string;
  stageType: string;
  attachment: { fileName: string; mimeType: string; sizeBytes: number } | null;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/**
 * La subida de archivos como evidencia se retiró a pedido del equipo. La evidencia es texto o un
 * enlace; los adjuntos guardados antes de retirar la función se conservan y se pueden descargar.
 */
describe('evidencia de etapa (sin adjuntar archivos)', () => {
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

  it('la evidencia de texto o enlace muestra autor, fecha y etapa, sin adjunto', async () => {
    const res = await beto.client.post(url(), { content: 'https://ejemplo.test/acta' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ content: 'https://ejemplo.test/acta', attachment: null, stageType: 'PLANNING', authorPseudonym: beto.pseudonym, createdAt: t.clock.now().toISOString() });
    const list = (await s.ana.client.get(url())).json() as Evidence[];
    expect(list).toHaveLength(1);
    expect(list[0]!.attachment).toBeNull();
  });

  it('ya no existe la ruta para subir archivos como evidencia', async () => {
    const res = await s.ana.client.upload(`${url()}/file`, { name: 'acta.md', data: '# Acta' }, { note: 'Acta' });
    expect(res.statusCode).toBe(404);
    expect(await getTestDb().evidenceAttachment.count()).toBe(0);
    expect(await getTestDb().evidence.count()).toBe(0);
  });

  it('la evidencia no es requisito para planificar ni avanzar', async () => {
    await fillPlan(s);
    expect(((await evaluatePlan(s)).json() as { status: string }).status).toBe('PASSED');
    expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
  });

  describe('adjuntos guardados antes de retirar la función', () => {
    async function adjuntoExistente() {
      const evidence = (await s.ana.client.post(url(), { content: 'Evidencia con un archivo antiguo' })).json() as Evidence;
      await getTestDb().evidenceAttachment.create({ data: { evidenceId: evidence.id, fileName: 'captura.png', mimeType: 'image/png', sizeBytes: PNG.length, data: new Uint8Array(PNG) } });
      return evidence;
    }

    it('se siguen listando y descargando, solo para miembros, como adjunto con tipo fijo', async () => {
      const evidence = await adjuntoExistente();
      const list = (await beto.client.get(url())).json() as Evidence[];
      expect(list[0]!.attachment).toEqual({ fileName: 'captura.png', mimeType: 'image/png', sizeBytes: PNG.length });
      const file = await beto.client.get(`${url()}/${evidence.id}/file`);
      expect(file.statusCode).toBe(200);
      expect(file.headers['content-type']).toBe('image/png');
      expect(file.headers['content-disposition']).toMatch(/^attachment;/);
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(file.rawPayload.equals(PNG)).toBe(true);
      expect((await intruso.client.get(`${url()}/${evidence.id}/file`)).statusCode).toBe(404);
    });

    it('aislamiento: no se descarga con la ruta de otro proyecto ni de otra etapa', async () => {
      const evidence = await adjuntoExistente();
      const otro = await createScenario(t.app);
      expect((await otro.ana.client.get(`${otro.base}/stages/PLANNING/evidence/${evidence.id}/file`)).statusCode).toBe(404);
      expect((await s.ana.client.get(`${url('REVIEW')}/${evidence.id}/file`)).statusCode).toBe(404);
    });
  });
});
