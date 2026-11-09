import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, resetDb } from '../helpers/db.js';
import { PASSWORD, createProject, createUser, uniqueEmail } from '../helpers/factories.js';
import { TestClient } from '../helpers/client.js';
import { createScenario, type Scenario } from '../helpers/scenario.js';

/** Endurecimiento de seguridad (T140, FR-037): cabeceras, cookies, CORS y ausencia de secretos. */
describe('seguridad transversal (T140)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('las respuestas llevan las cabeceras de helmet, incluido HSTS, y no revelan el servidor', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('la cookie de sesión es HttpOnly, Secure y SameSite', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail('seg');
    await client.post('/auth/register', { email, password: PASSWORD });
    const login = await client.login(email, PASSWORD);
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    const sid = cookies.find((c) => c.startsWith('sid='));
    expect(sid).toBeDefined();
    expect(sid).toMatch(/HttpOnly/i);
    expect(sid).toMatch(/Secure/i);
    expect(sid).toMatch(/SameSite=(Lax|Strict)/i);
  });

  it('CORS está cerrado: un origen ajeno no recibe permiso', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'https://sitio-malicioso.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const pre = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/projects',
      headers: { origin: 'https://sitio-malicioso.example', 'access-control-request-method': 'POST' },
    });
    expect(pre.headers['access-control-allow-origin']).toBeUndefined();
  });

  describe('ningún secreto en respuestas', () => {
    let s: Scenario;
    beforeEach(async () => {
      s = await createScenario(t.app);
    });

    const SECRETS = /argon2|password_?hash|passwordHash|tokenHash|token_hash|csrfTokenHash|SESSION_SECRET|\$argon/i;

    it('ni las cuentas, proyectos, miembros ni la actividad exponen contraseñas, hashes ni correos ajenos', async () => {
      const beto = await createUser(t.app, 'beto');
      await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'PARTICIPANT' });
      const urls = ['/auth/me', '/projects', `/projects/${s.projectId}`, `/projects/${s.projectId}/members`, `/projects/${s.projectId}/activity`];
      for (const url of urls) {
        const res = await s.ana.client.get(url);
        expect(res.body, url).not.toMatch(SECRETS);
        expect(res.body, url).not.toContain(PASSWORD);
      }
      // El Participante no ve el correo de los demás: solo seudónimos.
      const lista = await beto.client.get(`/projects/${s.projectId}/members`);
      expect(lista.body).not.toContain(s.ana.email);
    });

    it('la exportación completa no contiene secretos, contraseñas ni correos', async () => {
      const res = await s.ana.client.get(`/projects/${s.projectId}/export?format=json&includeText=true`);
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toMatch(SECRETS);
      expect(res.body).not.toContain(s.ana.email);
    });

    it('un error interno no filtra detalles (el manejador general responde en español)', async () => {
      const res = await s.ana.client.get(`/projects/${s.projectId}/sprints/00000000-0000-4000-8000-000000000000`);
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toMatch(/prisma|stack|node_modules|SELECT /i);
    });
  });

  it('el inicio de sesión tiene límite de tasa por IP', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail('rl');
    await client.post('/auth/register', { email, password: PASSWORD });
    const statuses: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      statuses.push((await client.post('/auth/login', { email, password: 'clave-incorrecta-123' })).statusCode);
    }
    expect(statuses).toContain(429);
    // Se crea un proyecto en otra instancia para confirmar que el límite no afecta rutas ajenas.
    const otro = await createUser(t.app, 'otro');
    expect((await createProject(otro)).id).toBeTruthy();
  });
});
