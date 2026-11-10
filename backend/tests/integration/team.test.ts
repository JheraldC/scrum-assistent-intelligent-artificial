import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { closeTestDb, getTestDb, resetDb } from '../helpers/db.js';
import { addMember, createProject, createUser, type TestUser } from '../helpers/factories.js';
import { createScenario, evaluatePlan, fillPlan, completeStage, type Scenario } from '../helpers/scenario.js';

interface Task {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  assigneePseudonym: string | null;
  backlogItemId: string | null;
  itemCode: string | null;
  version: number;
  fromAi: boolean;
}

describe('responsabilidades, tareas opcionales, decisiones y vistas por rol', () => {
  let t: TestApp;
  let s: Scenario;
  let beto: TestUser; // Participante
  let intruso: TestUser; // sin membresía

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

  const p = () => `/projects/${s.projectId}`;

  describe('responsabilidades Scrum por proyecto', () => {
    const url = (userId: string) => `${p()}/members/${userId}/responsibilities`;

    it('el Facilitador las configura y una persona puede tener varias; se muestran en la lista de miembros', async () => {
      const res = await s.ana.client.put(url(beto.id), { responsibilities: ['DEVELOPER', 'PRODUCT_OWNER'] });
      expect(res.statusCode).toBe(200);
      const members = (await s.ana.client.get(`${p()}/members`)).json() as { userId: string; responsibilities: string[] }[];
      expect(members.find((m) => m.userId === beto.id)!.responsibilities).toEqual(['DEVELOPER', 'PRODUCT_OWNER']);
      expect(members.find((m) => m.userId === s.ana.id)!.responsibilities).toEqual([]);
    });

    it('son independientes de los permisos: el Facilitador no es Scrum Master por defecto y un Scrum Master puede ser Participante', async () => {
      await s.ana.client.put(url(beto.id), { responsibilities: ['SCRUM_MASTER'] });
      const list = (await beto.client.get(`${p()}/members`)).json() as { userId: string; role: string; responsibilities: string[] }[];
      expect(list.find((m) => m.userId === beto.id)).toMatchObject({ role: 'PARTICIPANT', responsibilities: ['SCRUM_MASTER'] });
      expect(list.find((m) => m.userId === s.ana.id)).toMatchObject({ role: 'FACILITATOR', responsibilities: [] });
      // Tener la responsabilidad no concede permisos de Facilitador.
      expect((await beto.client.put(url(s.ana.id), { responsibilities: ['DEVELOPER'] })).statusCode).toBe(403);
      expect((await beto.client.post(`${p()}/sprints`)).statusCode).toBe(403);
    });

    it('un Participante no las cambia (403) y un ajeno no ve el proyecto (404)', async () => {
      expect((await beto.client.put(url(beto.id), { responsibilities: ['DEVELOPER'] })).statusCode).toBe(403);
      expect((await intruso.client.put(url(beto.id), { responsibilities: ['DEVELOPER'] })).statusCode).toBe(404);
    });

    it.each([
      ['valor desconocido', { responsibilities: ['JEFE'] }],
      ['repetidas', { responsibilities: ['DEVELOPER', 'DEVELOPER'] }],
      ['sin lista', {}],
    ])('rechaza %s con 422', async (_c, body) => {
      expect((await s.ana.client.put(url(beto.id), body)).statusCode).toBe(422);
    });

    it('se pueden quitar todas y no se pueden asignar a alguien de otro proyecto', async () => {
      await s.ana.client.put(url(beto.id), { responsibilities: ['DEVELOPER'] });
      expect((await s.ana.client.put(url(beto.id), { responsibilities: [] })).statusCode).toBe(200);
      expect((await s.ana.client.put(url(intruso.id), { responsibilities: ['DEVELOPER'] })).statusCode).toBe(404);
    });
  });

  describe('Product Goal y Definition of Done', () => {
    it('los proyectos existentes tienen DoD vacía y siguen funcionando', async () => {
      const project = (await s.ana.client.get(p())).json() as { definitionOfDone: string; productGoal: string };
      expect(project.definitionOfDone).toBe('');
      expect(project.productGoal).not.toBe('');
    });

    it('el Facilitador edita Product Goal y DoD con control de versión; omitir la DoD la conserva', async () => {
      const before = (await s.ana.client.get(p())).json() as { name: string; description: string; productGoal: string; version: number };
      const body = { name: before.name, description: before.description, productGoal: 'Nuevo Product Goal', definitionOfDone: 'Código revisado y con pruebas', expectedVersion: before.version };
      const saved = await s.ana.client.patch(p(), body);
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({ productGoal: 'Nuevo Product Goal', definitionOfDone: 'Código revisado y con pruebas', version: before.version + 1 });
      const { definitionOfDone: _omit, ...withoutDod } = body;
      const again = await s.ana.client.patch(p(), { ...withoutDod, expectedVersion: before.version + 1 });
      expect(again.json().definitionOfDone).toBe('Código revisado y con pruebas');
      const stale = await s.ana.client.patch(p(), { ...body, expectedVersion: before.version });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().current.definitionOfDone).toBe('Código revisado y con pruebas');
    });

    it('la DoD tiene un máximo de 2000 caracteres y un Participante no la edita', async () => {
      const before = (await s.ana.client.get(p())).json() as { name: string; description: string; productGoal: string; version: number };
      const base = { name: before.name, description: before.description, productGoal: before.productGoal, expectedVersion: before.version };
      expect((await s.ana.client.patch(p(), { ...base, definitionOfDone: 'x'.repeat(2001) })).statusCode).toBe(422);
      expect((await beto.client.patch(p(), { ...base, definitionOfDone: 'algo' })).statusCode).toBe(403);
    });

    it('es visible para todo el equipo y no para otros proyectos', async () => {
      const before = (await s.ana.client.get(p())).json() as { name: string; description: string; productGoal: string; version: number };
      await s.ana.client.patch(p(), { name: before.name, description: before.description, productGoal: before.productGoal, definitionOfDone: 'DoD visible', expectedVersion: before.version });
      expect(((await beto.client.get(p())).json() as { definitionOfDone: string }).definitionOfDone).toBe('DoD visible');
      expect((await intruso.client.get(p())).statusCode).toBe(404);
    });
  });

  describe('tareas opcionales del Sprint', () => {
    const base = () => `${s.base}/tasks`;
    const crear = (body: object, user = s.ana) => user.client.post(base(), body);

    it('el Sprint funciona sin tareas: la planificación no las exige', async () => {
      await fillPlan(s);
      expect(((await evaluatePlan(s)).json() as { status: string }).status).toBe('PASSED');
      expect((await completeStage(s, 'PLANNING')).statusCode).toBe(200);
      expect((await s.ana.client.get(base())).json()).toEqual([]);
    });

    it('cualquier miembro crea tareas, con o sin elemento y con o sin responsable', async () => {
      await fillPlan(s);
      const libre = await crear({ title: 'Preparar el entorno' }, beto);
      expect(libre.statusCode).toBe(201);
      expect(libre.json()).toMatchObject({ title: 'Preparar el entorno', status: 'TODO', backlogItemId: null, assigneeId: null, fromAi: false });
      const ligada = await crear({ title: 'Diseñar formulario', backlogItemId: s.storyId });
      expect(ligada.json()).toMatchObject({ itemCode: 'HU-1', assigneeId: null });
    });

    it('la asignación es opcional y solo a miembros del proyecto', async () => {
      await fillPlan(s);
      const asignada = await crear({ title: 'Con responsable', assigneeId: beto.id });
      expect(asignada.json()).toMatchObject({ assigneeId: beto.id, assigneePseudonym: beto.pseudonym });
      expect((await crear({ title: 'Con ajeno', assigneeId: intruso.id })).statusCode).toBe(422);
    });

    it('solo se asocian a elementos seleccionados para el Sprint', async () => {
      // La historia aún no está seleccionada.
      expect((await crear({ title: 'Sin seleccionar', backlogItemId: s.storyId })).statusCode).toBe(422);
      await fillPlan(s);
      expect((await crear({ title: 'Seleccionada', backlogItemId: s.storyId })).statusCode).toBe(201);
    });

    it.each([
      ['título vacío', { title: '' }],
      ['título de 201 caracteres', { title: 'x'.repeat(201) }],
      ['estado desconocido', { title: 'ok', status: 'HECHO' }],
      ['sin título', {}],
    ])('rechaza %s con 422', async (_c, body) => {
      expect((await crear(body)).statusCode).toBe(422);
    });

    it('se actualiza estado y título con control de versión; dos cambios simultáneos: uno gana', async () => {
      const task = (await crear({ title: 'Tarea' })).json() as Task;
      const done = await s.ana.client.patch(`${base()}/${task.id}`, { status: 'DONE', expectedVersion: task.version });
      expect(done.json()).toMatchObject({ status: 'DONE', version: task.version + 1 });
      const stale = await beto.client.patch(`${base()}/${task.id}`, { title: 'Otro título', expectedVersion: task.version });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().current.status).toBe('DONE');
      const [a, b] = await Promise.all([
        s.ana.client.patch(`${base()}/${task.id}`, { status: 'DOING', expectedVersion: task.version + 1 }),
        beto.client.patch(`${base()}/${task.id}`, { status: 'TODO', expectedVersion: task.version + 1 }),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    });

    it('se pueden quitar la asignación y el elemento', async () => {
      await fillPlan(s);
      const task = (await crear({ title: 'Tarea', assigneeId: beto.id, backlogItemId: s.storyId })).json() as Task;
      const res = await s.ana.client.patch(`${base()}/${task.id}`, { assigneeId: null, backlogItemId: null, expectedVersion: task.version });
      expect(res.json()).toMatchObject({ assigneeId: null, backlogItemId: null });
    });

    it('se eliminan, y una tarea inexistente o de otro proyecto da 404', async () => {
      const task = (await crear({ title: 'Tarea' })).json() as Task;
      expect((await intruso.client.delete(`${base()}/${task.id}`)).statusCode).toBe(404);
      expect((await s.ana.client.delete(`${base()}/${task.id}`)).statusCode).toBe(204);
      expect((await s.ana.client.delete(`${base()}/${task.id}`)).statusCode).toBe(404);
      const otro = await createScenario(t.app);
      expect((await otro.ana.client.patch(`${otro.base}/tasks/${task.id}`, { title: 'x', expectedVersion: 1 })).statusCode).toBe(404);
    });

    it('un Sprint cerrado no admite cambios de tareas y un ajeno no las ve', async () => {
      const task = (await crear({ title: 'Tarea' })).json() as Task;
      expect((await intruso.client.get(base())).statusCode).toBe(404);
      await getTestDb().sprint.update({ where: { id: s.sprintId }, data: { status: 'CLOSED', closedAt: new Date() } });
      expect((await crear({ title: 'Tarde' })).statusCode).toBe(409);
      expect((await s.ana.client.patch(`${base()}/${task.id}`, { status: 'DONE', expectedVersion: 1 })).statusCode).toBe(409);
      expect((await s.ana.client.get(base())).statusCode).toBe(200);
    });
  });

  describe('decisiones y acuerdos', () => {
    it('cualquier miembro registra una decisión o acuerdo con texto, fecha del servidor y autor', async () => {
      const res = await beto.client.post(`${p()}/decisions`, { kind: 'AGREEMENT', text: 'La Daily será a las 9:00' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ kind: 'AGREEMENT', text: 'La Daily será a las 9:00', authorPseudonym: beto.pseudonym, createdAt: t.clock.now().toISOString() });
    });

    it('se listan de la más reciente a la más antigua y son visibles solo para el equipo', async () => {
      await s.ana.client.post(`${p()}/decisions`, { kind: 'DECISION', text: 'Primera' });
      t.clock.advance(1000);
      await beto.client.post(`${p()}/decisions`, { kind: 'DECISION', text: 'Segunda' });
      expect(((await beto.client.get(`${p()}/decisions`)).json() as { text: string }[]).map((d) => d.text)).toEqual(['Segunda', 'Primera']);
      expect((await intruso.client.get(`${p()}/decisions`)).statusCode).toBe(404);
      expect((await intruso.client.post(`${p()}/decisions`, { kind: 'DECISION', text: 'x' })).statusCode).toBe(404);
    });

    it.each([
      ['texto vacío', { kind: 'DECISION', text: '' }],
      ['texto de 1001 caracteres', { kind: 'DECISION', text: 'x'.repeat(1001) }],
      ['tipo desconocido', { kind: 'ORDEN', text: 'x' }],
    ])('rechaza %s con 422', async (_c, body) => {
      expect((await s.ana.client.post(`${p()}/decisions`, body)).statusCode).toBe(422);
    });

    it('es de solo inserción: no hay edición ni borrado', async () => {
      const d = (await s.ana.client.post(`${p()}/decisions`, { kind: 'DECISION', text: 'Fija' })).json() as { id: string };
      expect((await s.ana.client.patch(`${p()}/decisions/${d.id}`, { text: 'x' })).statusCode).toBe(404);
      expect((await s.ana.client.delete(`${p()}/decisions/${d.id}`)).statusCode).toBe(404);
    });
  });

  describe('vistas por responsabilidad', () => {
    it('Scrum Master: Sprint Goal, estado, impedimentos, acciones pendientes, asuntos y decisiones', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      await completeStage(s, 'PLANNING');
      await s.ana.client.post(`${s.base}/tracking`, { kind: 'IMPEDIMENT', content: 'No hay acceso al servidor' });
      await s.ana.client.post(`${s.base}/retrospective/actions`, { description: 'Limitar la daily a quince minutos' });
      await s.ana.client.post(`${p()}/decisions`, { kind: 'DECISION', text: 'Usaremos PostgreSQL' });

      const view = (await beto.client.get(`${p()}/views/scrum-master`)).json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(view.sprint.sprintGoal).toContain('asistencia');
      expect(view.sprint.stages).toHaveLength(4);
      expect(view.impediments).toHaveLength(1);
      expect(view.retroActions).toHaveLength(1);
      expect(view.decisions[0].text).toBe('Usaremos PostgreSQL');
      const codes = view.attention.map((a: { code: string }) => a.code);
      expect(codes).toEqual(expect.arrayContaining(['OPEN_IMPEDIMENTS', 'RETRO_ACTIONS_PENDING', 'NO_DOD']));
    });

    it('no vigila a las personas: los impedimentos no muestran autor ni hay conteos por persona', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      await completeStage(s, 'PLANNING');
      await beto.client.post(`${s.base}/tracking`, { kind: 'IMPEDIMENT', content: 'Falta una licencia' });
      const res = await s.ana.client.get(`${p()}/views/scrum-master`);
      expect(res.body).not.toContain(beto.pseudonym);
      expect(res.body).not.toContain(beto.email);
      expect(JSON.stringify(res.json().impediments[0])).not.toMatch(/author|pseudonym/i);
    });

    it('detecta impedimentos antiguos con el reloj del servidor', async () => {
      await fillPlan(s);
      await evaluatePlan(s);
      await completeStage(s, 'PLANNING');
      await s.ana.client.post(`${s.base}/tracking`, { kind: 'IMPEDIMENT', content: 'Bloqueo' });
      t.clock.advance(3 * 86_400_000);
      const view = (await s.ana.client.get(`${p()}/views/scrum-master`)).json() as { attention: { code: string }[] };
      expect(view.attention.map((a) => a.code)).toContain('STALE_IMPEDIMENTS');
    });

    it('sin Sprint abierto la vista funciona e informa', async () => {
      const otro = await createUser(t.app, 'otro');
      const proyecto = await createProject(otro);
      const view = (await otro.client.get(`/projects/${proyecto.id}/views/scrum-master`)).json() as { sprint: unknown; attention: { code: string }[] };
      expect(view.sprint).toBeNull();
      expect(view.attention.map((a) => a.code)).toContain('NO_OPEN_SPRINT');
      const dev = (await otro.client.get(`/projects/${proyecto.id}/views/developers`)).json() as { sprint: unknown; items: unknown[] };
      expect(dev.sprint).toBeNull();
      expect(dev.items).toEqual([]);
    });

    it('Product Owner: Product Goal, DoD, backlog ordenado, elementos que necesitan aclaración y comentarios de la Review', async () => {
      await s.ana.client.post(`${p()}/backlog`, { kind: 'ITEM', title: 'Exportar reportes', description: 'Pendiente de detallar', priority: 2 });
      await s.ana.client.put(`${s.base}/review`, { results: 'r', increment: 'i', feedback: 'Pidieron un resumen semanal', goalAssessment: 'PARTIAL', goalAssessmentNote: 'n', expectedVersion: 1 });
      const view = (await beto.client.get(`${p()}/views/product-owner`)).json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(view.project.productGoal).not.toBe('');
      expect(view.backlog.map((b: { code: string }) => b.code)).toEqual(['HU-1', 'EL-1']);
      const item = view.backlog.find((b: { code: string }) => b.code === 'EL-1');
      expect(item.needsClarification).toBe(true);
      expect(item.reasons).toEqual(expect.arrayContaining(['Sin criterios de aceptación', 'Aún no se evaluó']));
      const story = view.backlog.find((b: { code: string }) => b.code === 'HU-1');
      expect(story.needsClarification).toBe(false);
      expect(story.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(view.reviewFeedback[0]).toMatchObject({ sprintNumber: 1, feedback: 'Pidieron un resumen semanal' });
    });

    it('Developers: Sprint Goal, elementos seleccionados con sus tareas y resumen de estados', async () => {
      await fillPlan(s);
      const task = (await s.ana.client.post(`${s.base}/tasks`, { title: 'Diseñar', backlogItemId: s.storyId })).json() as Task;
      await s.ana.client.patch(`${s.base}/tasks/${task.id}`, { status: 'DONE', expectedVersion: task.version });
      await s.ana.client.post(`${s.base}/tasks`, { title: 'Tarea suelta' });
      const view = (await beto.client.get(`${p()}/views/developers`)).json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(view.sprint.sprintGoal).toContain('asistencia');
      expect(view.items).toHaveLength(1);
      expect(view.items[0].tasks).toHaveLength(1);
      expect(view.unlinkedTasks).toHaveLength(1);
      expect(view.summary).toEqual({ todo: 1, doing: 0, done: 1 });
    });

    it('son visibles para cualquier miembro (con o sin responsabilidad) y no para ajenos; no mezclan proyectos', async () => {
      for (const v of ['scrum-master', 'product-owner', 'developers']) {
        expect((await beto.client.get(`${p()}/views/${v}`)).statusCode, v).toBe(200);
        expect((await intruso.client.get(`${p()}/views/${v}`)).statusCode, v).toBe(404);
      }
      const otro = await createScenario(t.app);
      await otro.ana.client.post(`${otro.base}/tasks`, { title: 'Tarea del otro proyecto' });
      const view = await s.ana.client.get(`${p()}/views/developers`);
      expect(view.body).not.toContain('Tarea del otro proyecto');
    });
  });
});
