import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { createProject, createUser } from '../helpers/factories.js';
import { accionBuena, createScenario, evaluateRetro, fillRetro, getRetro, getSprint, retroBuena, retroUrl, type Scenario } from '../helpers/scenario.js';

interface Run {
  id: string;
  status: string;
  results: { criterionId: string; outcome: string; origin: string }[];
}

describe('retrospectiva y acciones (T110, FR-018, FR-019, FR-036)', () => {
  let t: TestApp;
  let s: Scenario;

  beforeAll(async () => {
    t = await buildTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    s = await createScenario(t.app);
  });
  afterAll(async () => {
    await t.app.close();
    await closeTestDb();
  });

  it('una retrospectiva nueva está vacía, en versión 1 y sin evaluar', async () => {
    const retro = await getRetro(s);
    expect(retro).toMatchObject({ positives: [], problems: [], improvements: [], version: 1, actions: [], gateState: 'NO_EVALUADA' });
  });

  describe('aspectos positivos, problemas y mejoras', () => {
    it('se guardan con la versión vigente y la incrementan', async () => {
      const res = await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ ...retroBuena, version: 2 });
    });

    it('los textos en blanco se descartan y los demás se recortan', async () => {
      const res = await s.ana.client.put(retroUrl(s), { positives: ['  Bien  ', '', '   '], problems: ['Mal'], improvements: [], expectedVersion: 1 });
      expect(res.json().positives).toEqual(['Bien']);
    });

    it('versión desactualizada: 409 con el estado actual', async () => {
      await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
      const stale = await s.ana.client.put(retroUrl(s), { positives: ['Tarde'], problems: [], improvements: [], expectedVersion: 1 });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().code).toBe('VERSION_CONFLICT');
      expect(stale.json().current.positives).toEqual(retroBuena.positives);
    });

    it('dos PUT simultáneos con la misma versión: uno gana y el otro recibe 409', async () => {
      const [a, b] = await Promise.all([
        s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 }),
        s.ana.client.put(retroUrl(s), { ...retroBuena, positives: ['Otro'], expectedVersion: 1 }),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    });

    it.each([
      ['31 elementos', { positives: Array.from({ length: 31 }, (_, i) => `p${i}`) }],
      ['un elemento de 501 caracteres', { problems: ['x'.repeat(501)] }],
      ['un valor que no es una lista', { positives: 'texto' }],
    ])('rechaza %s con 422', async (_caso, body) => {
      const res = await s.ana.client.put(retroUrl(s), { positives: [], problems: [], improvements: [], ...body, expectedVersion: 1 });
      expect(res.statusCode).toBe(422);
    });

    it('acepta 30 elementos de 500 caracteres (límites)', async () => {
      const res = await s.ana.client.put(retroUrl(s), { positives: Array.from({ length: 30 }, () => 'x'.repeat(500)), problems: [], improvements: [], expectedVersion: 1 });
      expect(res.statusCode).toBe(200);
    });

    it('el primer cambio mueve la etapa de retrospectiva a IN_PROGRESS', async () => {
      await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
      expect((await getSprint(s)).stages.find((x) => x.type === 'RETROSPECTIVE')!.status).toBe('IN_PROGRESS');
    });
  });

  describe('acciones de mejora', () => {
    const crear = (body: object, user = s.ana) => user.client.post(`${retroUrl(s)}/actions`, body);

    it('crea una acción con responsable (miembro del proyecto) y estado inicial OPEN', async () => {
      const res = await crear({ ...accionBuena, ownerId: s.ana.id });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ description: accionBuena.description, ownerId: s.ana.id, forNextSprint: true, status: 'OPEN', version: 1, followUpUpdatedAt: null });
      expect(res.json().ownerPseudonym).toBe(s.ana.pseudonym);
    });

    it('se puede crear sin responsable (la regla RETRO-04 lo señalará)', async () => {
      const res = await crear({ description: 'Escribir una guía de trabajo del equipo' });
      expect(res.statusCode).toBe(201);
      expect(res.json().ownerId).toBeNull();
    });

    it('el responsable debe ser miembro del proyecto (422 si no)', async () => {
      const ajeno = await createUser(t.app, 'ajeno');
      const res = await crear({ ...accionBuena, ownerId: ajeno.id });
      expect(res.statusCode).toBe(422);
    });

    it.each([
      ['descripción vacía', { description: '' }],
      ['descripción de solo espacios', { description: '   ' }],
      ['descripción de 301 caracteres', { description: 'x'.repeat(301) }],
      ['nota de seguimiento de 501 caracteres', { description: 'Una acción válida del equipo', followUpNote: 'n'.repeat(501) }],
      ['estado desconocido', { description: 'Una acción válida del equipo', status: 'QUIZAS' }],
    ])('rechaza %s con 422', async (_caso, body) => {
      expect((await crear(body)).statusCode).toBe(422);
    });

    it('acepta una descripción de exactamente 300 caracteres', async () => {
      expect((await crear({ description: 'x'.repeat(300) })).statusCode).toBe(201);
    });

    it('editar una acción con la versión vigente la incrementa; con una vieja da 409 y el estado actual', async () => {
      const a = (await crear({ ...accionBuena, ownerId: s.ana.id })).json() as { id: string };
      const url = `${retroUrl(s)}/actions/${a.id}`;
      const ok = await s.ana.client.patch(url, { description: 'Descripción actualizada de la acción', expectedVersion: 1 });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().version).toBe(2);
      const stale = await s.ana.client.patch(url, { description: 'Otra descripción distinta', expectedVersion: 1 });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().current.description).toBe('Descripción actualizada de la acción');
    });

    it('actualizar estado o nota de seguimiento registra la fecha de seguimiento; cambiar la descripción no', async () => {
      const a = (await crear({ ...accionBuena, ownerId: s.ana.id })).json() as { id: string };
      const url = `${retroUrl(s)}/actions/${a.id}`;
      const solo = await s.ana.client.patch(url, { description: 'Descripción cambiada sin seguimiento', expectedVersion: 1 });
      expect(solo.json().followUpUpdatedAt).toBeNull();
      t.clock.advance(5000);
      const seg = await s.ana.client.patch(url, { status: 'DONE', followUpNote: 'Se aplicó con éxito', expectedVersion: 2 });
      expect(seg.json()).toMatchObject({ status: 'DONE', followUpNote: 'Se aplicó con éxito', followUpUpdatedAt: t.clock.now().toISOString() });
    });

    it('dos ediciones simultáneas de la misma acción: una gana y la otra recibe 409', async () => {
      const a = (await crear({ ...accionBuena, ownerId: s.ana.id })).json() as { id: string };
      const url = `${retroUrl(s)}/actions/${a.id}`;
      const [x, y] = await Promise.all([
        s.ana.client.patch(url, { description: 'Edición simultánea número uno', expectedVersion: 1 }),
        s.ana.client.patch(url, { description: 'Edición simultánea número dos', expectedVersion: 1 }),
      ]);
      expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
    });

    it('una acción de otro Sprint o proyecto no es accesible (404)', async () => {
      const a = (await crear({ ...accionBuena, ownerId: s.ana.id })).json() as { id: string };
      const beto = await createUser(t.app, 'beto');
      const pb = await createProject(beto);
      const sb = (await beto.client.post(`/projects/${pb.id}/sprints`)).json() as { id: string };
      const res = await beto.client.patch(`/projects/${pb.id}/sprints/${sb.id}/retrospective/actions/${a.id}`, { description: 'Intento ajeno de edición', expectedVersion: 1 });
      expect(res.statusCode).toBe(404);
    });

    it('crear o editar acciones incrementa la versión de la retrospectiva (la evaluación queda desactualizada)', async () => {
      await fillRetro(s);
      expect(((await evaluateRetro(s)).json() as Run).status).toBe('PASSED');
      expect((await getRetro(s)).gateState).toBe('APROBADA');
      await crear({ description: 'Una nueva acción posterior a la evaluación', ownerId: s.ana.id });
      expect((await getRetro(s)).gateState).toBe('DESACTUALIZADA');
    });
  });

  describe('evaluación GATE-RETRO', () => {
    it('sin acciones: FAILED con RETRO-01 no cumplido y la etapa pasa a NEEDS_CORRECTION', async () => {
      await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 });
      const run = (await evaluateRetro(s)).json() as Run;
      expect(run.status).toBe('FAILED');
      expect(run.results.find((r) => r.criterionId === 'RETRO-01')!.outcome).toBe('NOT_MET');
      expect(run.results).toHaveLength(6);
      expect((await getRetro(s)).gateState).toBe('NO_APROBADA');
      expect((await getSprint(s)).stages.find((x) => x.type === 'RETROSPECTIVE')!.status).toBe('NEEDS_CORRECTION');
    });

    it('una acción sin responsable se señala (RETRO-04)', async () => {
      await fillRetro(s, { ownerId: null });
      const run = (await evaluateRetro(s)).json() as Run;
      expect(run.status).toBe('FAILED');
      expect(run.results.find((r) => r.criterionId === 'RETRO-04')!.outcome).toBe('NOT_MET');
    });

    it('con todo correcto: PASSED', async () => {
      await fillRetro(s);
      const run = (await evaluateRetro(s)).json() as Run;
      expect(run.status).toBe('PASSED');
      expect(new Set(run.results.map((r) => r.origin))).toEqual(new Set(['OFFICIAL', 'ADDITIONAL']));
    });

    it('RETRO-05: las acciones del Sprint anterior sin seguimiento impiden aprobar; al actualizarlas se cumple', async () => {
      // Sprint 1: una acción abierta; se cierra el Sprint y se crea el 2.
      await fillRetro(s);
      const anterior = (await getRetro(s)).actions[0]!;
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: t.clock.now() } });
      const sprint1Base = s.base;
      const s2 = (await s.ana.client.post(`/projects/${s.projectId}/sprints`)).json() as { id: string; number: number };
      expect(s2.number).toBe(2);
      const sprint2: Scenario = { ...s, sprintId: s2.id, base: `/projects/${s.projectId}/sprints/${s2.id}` };
      t.clock.advance(60_000);

      await fillRetro(sprint2);
      let run = (await evaluateRetro(sprint2)).json() as Run;
      expect(run.status).toBe('FAILED');
      expect(run.results.find((r) => r.criterionId === 'RETRO-05')!.outcome).toBe('NOT_MET');

      // Se actualiza el seguimiento de las acciones del Sprint 1 (cerrado).
      const seg = await s.ana.client.patch(`${sprint1Base}/retrospective/actions/${anterior.id}`, { status: 'DONE', followUpNote: 'Funcionó', expectedVersion: anterior.version });
      expect(seg.statusCode).toBe(200);
      run = (await evaluateRetro(sprint2)).json() as Run;
      expect(run.results.find((r) => r.criterionId === 'RETRO-05')!.outcome).toBe('MET');
      expect(run.status).toBe('PASSED');
    });

    it('un Sprint cerrado solo admite actualizar el seguimiento de sus acciones, no su contenido', async () => {
      await fillRetro(s);
      const accion = (await getRetro(s)).actions[0]!;
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: t.clock.now() } });
      const contenido = await s.ana.client.patch(`${retroUrl(s)}/actions/${accion.id}`, { description: 'Intento de cambiar el contenido', expectedVersion: accion.version });
      expect(contenido.statusCode).toBe(409);
      expect((await s.ana.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 5 })).statusCode).toBe(409);
      expect((await s.ana.client.post(`${retroUrl(s)}/actions`, { description: 'Una acción nueva en Sprint cerrado' })).statusCode).toBe(409);
      const seguimiento = await s.ana.client.patch(`${retroUrl(s)}/actions/${accion.id}`, { status: 'DONE', expectedVersion: accion.version });
      expect(seguimiento.statusCode).toBe(200);
    });
  });

  it('cualquier miembro edita la retrospectiva; un ajeno al proyecto recibe 404', async () => {
    const beto = await createUser(t.app, 'beto');
    await s.ana.client.post(`/projects/${s.projectId}/members`, { email: beto.email, role: 'PARTICIPANT' });
    expect((await beto.client.put(retroUrl(s), { ...retroBuena, expectedVersion: 1 })).statusCode).toBe(200);
    const intruso = await createUser(t.app, 'intruso');
    expect((await intruso.client.get(retroUrl(s))).statusCode).toBe(404);
  });
});
