import { describe, expect, it } from 'vitest';
import { AgentBudget, startOfUtcDay, type BudgetStore } from '../../../src/modules/agent/budget.js';
import { TestClock } from '../../../src/platform/clock.js';

class MemoryStore implements BudgetStore {
  calls: { userId: string; at: Date }[] = [];
  tokens: { projectId: string; at: Date; n: number }[] = [];
  async callsSince(userId: string, since: Date) {
    return this.calls.filter((c) => c.userId === userId && c.at >= since).length;
  }
  async tokensSince(since: Date, projectId?: string) {
    return this.tokens.filter((t) => t.at >= since && (!projectId || t.projectId === projectId)).reduce((a, t) => a + t.n, 0);
  }
}

const limits = { userRatePerMinute: 3, dailyTokenBudgetGlobal: 1000, dailyTokenBudgetPerProject: 400 };

function setup() {
  const clock = new TestClock(new Date('2026-03-10T15:30:00.000Z'));
  const store = new MemoryStore();
  return { clock, store, budget: new AgentBudget(store, clock, limits) };
}

describe('límites y presupuesto de IA (T088, FR-024a)', () => {
  it('permite llamadas mientras no se alcance ningún límite', async () => {
    const { budget } = setup();
    await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
  });

  describe('límite por persona y por minuto', () => {
    it('rechaza la solicitud número 4 dentro del mismo minuto con RATE_LIMITED', async () => {
      const { budget, store, clock } = setup();
      for (let i = 0; i < 3; i += 1) store.calls.push({ userId: 'u1', at: clock.now() });
      await expect(budget.check('u1', 'p1')).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    });
    it('otra persona no se ve afectada', async () => {
      const { budget, store, clock } = setup();
      for (let i = 0; i < 3; i += 1) store.calls.push({ userId: 'u1', at: clock.now() });
      await expect(budget.check('u2', 'p1')).resolves.toBeUndefined();
    });
    it('las llamadas de hace más de un minuto no cuentan', async () => {
      const { budget, store, clock } = setup();
      for (let i = 0; i < 3; i += 1) store.calls.push({ userId: 'u1', at: new Date(clock.now().getTime() - 61_000) });
      await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
    });
  });

  describe('presupuesto diario (día UTC)', () => {
    it('presupuesto global agotado: AI_BUDGET_EXCEEDED con la hora de restablecimiento', async () => {
      const { budget, store, clock } = setup();
      store.tokens.push({ projectId: 'otro', at: clock.now(), n: 1000 });
      const error = await budget.check('u1', 'p1').catch((e: unknown) => e as { code: string; status: number; message: string });
      expect(error).toMatchObject({ code: 'AI_BUDGET_EXCEEDED', status: 429 });
      expect(String((error as { message: string }).message)).toMatch(/00:00|medianoche|UTC/i);
    });
    it('presupuesto por proyecto agotado: solo bloquea a ese proyecto', async () => {
      const { budget, store, clock } = setup();
      store.tokens.push({ projectId: 'p1', at: clock.now(), n: 400 });
      await expect(budget.check('u1', 'p1')).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
      await expect(budget.check('u1', 'p2')).resolves.toBeUndefined();
    });
    it('justo por debajo del límite todavía se permite', async () => {
      const { budget, store, clock } = setup();
      store.tokens.push({ projectId: 'p1', at: clock.now(), n: 399 });
      await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
    });
    it('el consumo de ayer no cuenta hoy', async () => {
      const { budget, store } = setup();
      store.tokens.push({ projectId: 'p1', at: new Date('2026-03-09T23:59:59.000Z'), n: 5000 });
      await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
    });
    it('el día UTC empieza a las 00:00 UTC', () => {
      expect(startOfUtcDay(new Date('2026-03-10T15:30:00.000Z')).toISOString()).toBe('2026-03-10T00:00:00.000Z');
    });
  });

  describe('cabeceras de límite del proveedor (prevalecen sobre el contador local)', () => {
    it('sin tokens restantes y con restablecimiento futuro: AI_BUDGET_EXCEEDED aunque el contador local esté bajo', async () => {
      const { budget, clock } = setup();
      budget.observeProvider({ remainingTokens: 0, resetAt: new Date(clock.now().getTime() + 3600_000) });
      await expect(budget.check('u1', 'p1')).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    });
    it('al pasar la hora de restablecimiento vuelve a permitir', async () => {
      const { budget, clock } = setup();
      budget.observeProvider({ remainingTokens: 0, resetAt: new Date(clock.now().getTime() + 60_000) });
      clock.advance(61_000);
      await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
    });
    it('con tokens restantes suficientes no bloquea', async () => {
      const { budget, clock } = setup();
      budget.observeProvider({ remainingTokens: 50_000, resetAt: new Date(clock.now().getTime() + 60_000) });
      await expect(budget.check('u1', 'p1')).resolves.toBeUndefined();
    });
  });

  it('el mensaje de límite es claro y en español', async () => {
    const { budget, store, clock } = setup();
    store.tokens.push({ projectId: 'p1', at: clock.now(), n: 5000 });
    const error = (await budget.check('u1', 'p1').catch((e: unknown) => e)) as Error;
    expect(error.message).toMatch(/asistente|cupo|límite/i);
    expect(error.message).toMatch(/reglas/i); // recuerda que las reglas siguen funcionando
  });
});
