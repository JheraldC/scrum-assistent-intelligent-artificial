import { describe, expect, it } from 'vitest';
import { evaluate, type RetroSnapshot } from '../../../src/modules/validation/index.js';

const INICIO = '2026-03-02T00:00:00.000Z';

const buena: RetroSnapshot = {
  positives: ['El equipo se comunicó bien durante el Sprint'],
  problems: ['Las reuniones diarias se alargaron demasiado'],
  improvements: ['Limitar la reunión diaria a quince minutos'],
  actions: [{ description: 'Limitar cada reunión diaria a quince minutos con temporizador', ownerId: 'user-1', forNextSprint: true }],
  previousActions: [],
  sprintStartedAt: INICIO,
};

const outcome = (s: RetroSnapshot, id: string) => evaluate('GATE-RETRO', s).results.find((r) => r.criterionId === id)!;

describe('reglas de retrospectiva RETRO-01…06 (T109, FR-018, FR-019)', () => {
  it('una retrospectiva bien formada pasa la compuerta', () => {
    const run = evaluate('GATE-RETRO', buena);
    expect(run.status).toBe('PASSED');
    expect(run.results.filter((r) => r.outcome === 'NOT_MET')).toEqual([]);
  });

  describe('RETRO-01 al menos una mejora (oficial)', () => {
    it('falla sin acciones y lo explica', () => {
      const r = outcome({ ...buena, actions: [] }, 'RETRO-01');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.explanation).toMatch(/acción|mejora/i);
      expect(r.recommendation).not.toBe('');
    });
    it('las acciones con descripción en blanco no cuentan', () => {
      expect(outcome({ ...buena, actions: [{ description: '   ', ownerId: 'u', forNextSprint: false }] }, 'RETRO-01').outcome).toBe('NOT_MET');
    });
    it('es oficial y obligatoria', () => {
      const r = outcome(buena, 'RETRO-01');
      expect([r.origin, r.mandatory]).toEqual(['OFFICIAL', true]);
    });
    it('una retrospectiva sin acciones no pasa la compuerta', () => {
      expect(evaluate('GATE-RETRO', { ...buena, actions: [] }).status).toBe('FAILED');
    });
  });

  describe('RETRO-02 aspectos positivos y problemas', () => {
    it('falla sin positivos', () => {
      expect(outcome({ ...buena, positives: [] }, 'RETRO-02').outcome).toBe('NOT_MET');
    });
    it('falla sin problemas', () => {
      expect(outcome({ ...buena, problems: [] }, 'RETRO-02').outcome).toBe('NOT_MET');
    });
    it('los textos en blanco no cuentan', () => {
      expect(outcome({ ...buena, positives: ['  '], problems: [''] }, 'RETRO-02').outcome).toBe('NOT_MET');
    });
    it('cumple con al menos uno de cada', () => {
      expect(outcome(buena, 'RETRO-02').outcome).toBe('MET');
    });
  });

  describe('RETRO-03 claridad de las acciones (5 palabras, sin términos vagos)', () => {
    const accion = (description: string) => ({ ...buena, actions: [{ description, ownerId: 'u', forNextSprint: false }] });
    it('una acción de 4 palabras falla y una de 5 cumple', () => {
      expect(outcome(accion('Hablar con el equipo'), 'RETRO-03').outcome).toBe('NOT_MET');
      expect(outcome(accion('Hablar con todo el equipo'), 'RETRO-03').outcome).toBe('MET');
    });
    it('falla con términos vagos y los indica', () => {
      const r = outcome(accion('Mejorar la comunicación de forma adecuada en el equipo'), 'RETRO-03');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toMatch(/mejorar|adecuada/i);
    });
    it('basta una acción mala entre varias buenas', () => {
      const s = { ...buena, actions: [...buena.actions, { description: 'Revisar', ownerId: 'u', forNextSprint: false }] };
      expect(outcome(s, 'RETRO-03').outcome).toBe('NOT_MET');
    });
    it('sin acciones no aplica', () => {
      expect(outcome({ ...buena, actions: [] }, 'RETRO-03').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('RETRO-04 responsable de cada acción', () => {
    it('falla si alguna acción no tiene responsable y la identifica', () => {
      const s = { ...buena, actions: [...buena.actions, { description: 'Escribir una guía de trabajo del equipo', ownerId: null, forNextSprint: false }] };
      const r = outcome(s, 'RETRO-04');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toMatch(/2/);
    });
    it('cumple si todas tienen responsable', () => {
      expect(outcome(buena, 'RETRO-04').outcome).toBe('MET');
    });
    it('sin acciones no aplica', () => {
      expect(outcome({ ...buena, actions: [] }, 'RETRO-04').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('RETRO-05 seguimiento de las acciones del Sprint anterior', () => {
    it('no aplica si el Sprint anterior no tenía acciones', () => {
      expect(outcome(buena, 'RETRO-05').outcome).toBe('NOT_APPLICABLE');
    });
    it('cumple si todas se actualizaron después del inicio del Sprint actual', () => {
      const s = { ...buena, previousActions: [{ followUpUpdatedAt: '2026-03-05T10:00:00.000Z' }, { followUpUpdatedAt: '2026-03-09T10:00:00.000Z' }] };
      expect(outcome(s, 'RETRO-05').outcome).toBe('MET');
    });
    it('falla si alguna no se actualizó nunca', () => {
      const r = outcome({ ...buena, previousActions: [{ followUpUpdatedAt: null }] }, 'RETRO-05');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.recommendation).toMatch(/seguimiento|estado/i);
    });
    it('falla si la última actualización es anterior al inicio del Sprint', () => {
      expect(outcome({ ...buena, previousActions: [{ followUpUpdatedAt: '2026-02-20T10:00:00.000Z' }] }, 'RETRO-05').outcome).toBe('NOT_MET');
    });
    it('una actualización exactamente en el instante de inicio no cuenta (debe ser posterior)', () => {
      expect(outcome({ ...buena, previousActions: [{ followUpUpdatedAt: INICIO }] }, 'RETRO-05').outcome).toBe('NOT_MET');
    });
    it('es obligatoria y adicional', () => {
      const r = outcome({ ...buena, previousActions: [{ followUpUpdatedAt: null }] }, 'RETRO-05');
      expect([r.origin, r.mandatory]).toEqual(['ADDITIONAL', true]);
    });
  });

  describe('RETRO-06 acción para el siguiente Sprint (orientativa)', () => {
    it('cumple si alguna acción está marcada', () => {
      expect(outcome(buena, 'RETRO-06').outcome).toBe('MET');
    });
    it('falla si ninguna lo está, pero no impide aprobar', () => {
      const s = { ...buena, actions: [{ ...buena.actions[0]!, forNextSprint: false }] };
      expect(outcome(s, 'RETRO-06').outcome).toBe('NOT_MET');
      expect(outcome(s, 'RETRO-06').mandatory).toBe(false);
      expect(evaluate('GATE-RETRO', s).status).toBe('PASSED');
    });
    it('sin acciones no aplica', () => {
      expect(outcome({ ...buena, actions: [] }, 'RETRO-06').outcome).toBe('NOT_APPLICABLE');
    });
  });

  it('el origen de cada criterio coincide con el catálogo', () => {
    const origenes = Object.fromEntries(evaluate('GATE-RETRO', buena).results.map((r) => [r.criterionId, r.origin]));
    expect(origenes).toEqual({
      'RETRO-01': 'OFFICIAL',
      'RETRO-02': 'ADDITIONAL',
      'RETRO-03': 'ADDITIONAL',
      'RETRO-04': 'ADDITIONAL',
      'RETRO-05': 'ADDITIONAL',
      'RETRO-06': 'ADDITIONAL',
    });
  });
});
