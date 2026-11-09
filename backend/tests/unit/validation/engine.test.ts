import { describe, expect, it } from 'vitest';
import { evaluate, evaluateWithRules, type RuleSet, type StorySnapshot } from '../../../src/modules/validation/index.js';

const snapshot: StorySnapshot = {
  kind: 'USER_STORY',
  title: 'Historia de prueba',
  asA: 'usuario',
  iWant: 'ver el estado de mi proyecto en un panel',
  soThat: 'puedo decidir el siguiente paso',
  description: null,
  acceptanceCriteria: ['El panel muestra las cuatro etapas del Sprint'],
  priority: 2,
};

describe('motor de reglas puro (T052, FR-012, FR-023)', () => {
  it('es determinista: la misma instantánea produce el mismo resultado', () => {
    expect(evaluate('GATE-STORY', snapshot)).toEqual(evaluate('GATE-STORY', structuredClone(snapshot)));
  });

  it('PASSED solo si todos los criterios obligatorios aplicables están MET', () => {
    expect(evaluate('GATE-STORY', snapshot).status).toBe('PASSED');
    expect(evaluate('GATE-STORY', { ...snapshot, acceptanceCriteria: [] }).status).toBe('FAILED');
  });

  it('un criterio no obligatorio incumplido no impide aprobar', () => {
    const run = evaluate('GATE-STORY', { ...snapshot, priority: 0 });
    expect(run.results.find((r) => r.criterionId === 'STORY-02')!.outcome).toBe('NOT_MET');
    expect(run.status).toBe('PASSED');
  });

  it('NOT_APPLICABLE no cuenta para la aprobación', () => {
    const item: StorySnapshot = { ...snapshot, kind: 'ITEM', asA: null, iWant: null, soThat: null, description: 'Preparar el entorno', acceptanceCriteria: [] };
    const run = evaluate('GATE-STORY', item);
    expect(run.results.filter((r) => r.outcome === 'NOT_APPLICABLE').length).toBeGreaterThan(0);
    expect(run.status).toBe('PASSED');
  });

  it('un error interno del motor produce ERROR y nunca aprueba', () => {
    const rules: RuleSet<StorySnapshot> = {
      'STORY-01': () => {
        throw new Error('fallo inesperado');
      },
    };
    const run = evaluateWithRules('GATE-STORY', snapshot, rules);
    expect(run.status).toBe('ERROR');
    expect(run.status).not.toBe('PASSED');
  });

  it('una regla que devuelve un resultado inválido también produce ERROR', () => {
    const rules = { 'STORY-01': () => ({ outcome: 'QUIZAS' }) } as unknown as RuleSet<StorySnapshot>;
    expect(evaluateWithRules('GATE-STORY', snapshot, rules).status).toBe('ERROR');
  });

  it('cada resultado conserva origen y obligatoriedad del catálogo', () => {
    for (const r of evaluate('GATE-STORY', snapshot).results) {
      expect(['OFFICIAL', 'ADDITIONAL']).toContain(r.origin);
      expect(typeof r.mandatory).toBe('boolean');
    }
  });
});
