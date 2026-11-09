import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PSEUDONYM_PATTERN } from '@scrum/shared';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { TestClient } from '../helpers/client.js';
import { PASSWORD, uniqueEmail } from '../helpers/factories.js';

describe('autenticación (T026, FR-001, FR-037)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(resetDb);
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('registro válido: 201 con seudónimo y sin datos de autenticación', async () => {
    const client = new TestClient(t.app);
    const res = await client.post('/auth/register', { email: 'Ana@Ejemplo.Test', password: PASSWORD });
    expect(res.statusCode).toBe(201);
    const me = res.json();
    expect(me.email).toBe('ana@ejemplo.test'); // normalizado a minúsculas
    expect(me.pseudonym).toMatch(PSEUDONYM_PATTERN);
    expect(JSON.stringify(me)).not.toMatch(/password|hash/i);
    expect(res.headers['set-cookie']).toBeUndefined(); // registrarse no inicia sesión
  });

  it('correo duplicado: 409 con mensaje claro', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    const res = await client.post('/auth/register', { email: email.toUpperCase(), password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/ya existe una cuenta/i);
  });

  it('contraseña de menos de 10 caracteres: 422 con mensaje en español', async () => {
    const res = await new TestClient(t.app).post('/auth/register', { email: uniqueEmail(), password: 'corta123' });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body.details)).toMatch(/al menos 10 caracteres/);
  });

  it('correo con formato inválido: 422', async () => {
    const res = await new TestClient(t.app).post('/auth/register', { email: 'no-es-correo', password: PASSWORD });
    expect(res.statusCode).toBe(422);
  });

  it('la contraseña se guarda con Argon2id, nunca en claro', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    const row = await getTestDb().user.findUnique({ where: { email } });
    expect(row?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('login correcto: cookie HttpOnly, Secure y SameSite=Lax; /auth/me devuelve la persona', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    const res = await client.login(email, PASSWORD);
    expect(res.statusCode).toBe(200);
    const cookie = String(([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sid=')));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await client.get('/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
  });

  it('login incorrecto: mismo mensaje genérico para correo inexistente y contraseña errónea', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    const wrong = await client.post('/auth/login', { email, password: 'otra-clave-distinta-1' });
    const unknown = await client.post('/auth/login', { email: uniqueEmail('nadie'), password: PASSWORD });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().message).toBe(unknown.json().message);
  });

  it('sin sesión, /auth/me responde 401', async () => {
    const res = await new TestClient(t.app).get('/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHENTICATED');
  });

  it('logout revoca la sesión en el servidor', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    await client.login(email, PASSWORD);
    const stolen = client.cookies.get('sid')!;
    expect((await client.logout()).statusCode).toBe(204);
    expect((await client.get('/auth/me')).statusCode).toBe(401);
    // El token anterior ya no sirve aunque alguien lo conserve.
    const replay = await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `sid=${stolen}` } });
    expect(replay.statusCode).toBe(401);
  });

  it('iniciar sesión de nuevo rota el identificador de sesión', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    await client.login(email, PASSWORD);
    const first = client.cookies.get('sid')!;
    await client.login(email, PASSWORD);
    expect(client.cookies.get('sid')).not.toBe(first);
    const replay = await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `sid=${first}` } });
    expect(replay.statusCode).toBe(401);
  });

  it('una sesión caducada (7 días) deja de ser válida', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    await client.login(email, PASSWORD);
    t.clock.advance(7 * 24 * 60 * 60 * 1000 + 1000);
    expect((await client.get('/auth/me')).statusCode).toBe(401);
    t.clock.advance(-(7 * 24 * 60 * 60 * 1000 + 1000));
  });

  it('límite de intentos fallidos por correo: 429', async () => {
    const client = new TestClient(t.app);
    const email = uniqueEmail();
    await client.post('/auth/register', { email, password: PASSWORD });
    let last = 0;
    for (let i = 0; i < 9; i += 1) last = (await client.post('/auth/login', { email, password: 'mala-clave-numero-1' })).statusCode;
    expect(last).toBe(429);
    // Incluso con la contraseña correcta mientras dura el bloqueo.
    expect((await client.post('/auth/login', { email, password: PASSWORD })).statusCode).toBe(429);
  });

  it('CSRF: sin token o con token erróneo se rechaza (403)', async () => {
    const client = new TestClient(t.app);
    const body = { email: uniqueEmail(), password: PASSWORD };
    const none = await client.post('/auth/register', body, { csrf: false });
    expect(none.statusCode).toBe(403);
    const wrong = await client.post('/auth/register', body, { csrf: 'token-falso' });
    expect(wrong.statusCode).toBe(403);
  });

  it('CSRF: un Origin ajeno se rechaza aunque el token sea válido', async () => {
    const client = new TestClient(t.app);
    const res = await client.post(
      '/auth/register',
      { email: uniqueEmail(), password: PASSWORD },
      { headers: { origin: 'https://sitio-malicioso.example' } },
    );
    expect(res.statusCode).toBe(403);
  });
});
