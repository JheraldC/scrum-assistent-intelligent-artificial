import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb } from '../helpers/db.js';

describe('base de la API (T020)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp({}, (app) => {
      app.post('/api/v1/_prueba-json', async (req) => req.body);
    });
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('GET /api/v1/health responde 200 con {"status":"ok"}', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('una ruta inexistente devuelve Problem 404 en español con requestId', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toMatch(/recurso/i);
    expect(typeof body.requestId).toBe('string');
  });

  it('un cuerpo JSON mal formado devuelve 422 con Problem en español, sin trazas', async () => {
    // La protección CSRF exige cookie anónima y token también en las pruebas.
    const csrf = await t.app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    const anon = ([] as string[]).concat(csrf.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/_prueba-json',
      headers: {
        'content-type': 'application/json',
        cookie: anon,
        'x-csrf-token': (csrf.json() as { csrfToken: string }).csrfToken,
      },
      payload: '{"roto":',
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.requestId).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/at \w+|node_modules|stack/i);
  });

  it('las cabeceras de seguridad de helmet están presentes', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
