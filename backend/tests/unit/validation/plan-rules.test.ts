import { describe, expect, it } from 'vitest';
import { evaluate, type PlanSnapshot } from '../../../src/modules/validation/index.js';

const buena: PlanSnapshot = {
  sprintGoal: 'Permitir que el equipo registre su asistencia diaria desde el panel',
  workPlan: 'HU-1: diseñar el formulario de asistencia. Luego implementar el registro de asistencia y probarlo.',
  items: [{ code: 'HU-1', title: 'Registrar asistencia del equipo', kind: 'USER_STORY', storyState: 'APROBADA' }],
};

const outcome = (snapshot: PlanSnapshot, id: string) => evaluate('GATE-PLAN', snapshot).results.find((r) => r.criterionId === id)!;
const words = (n: number) => Array.from({ length: n }, (_, i) => `meta${i}`).join(' ');

describe('reglas de planificación PLAN-01…07 (T070, FR-011, FR-012, FR-017)', () => {
  it('un plan bien formado pasa la compuerta', () => {
    const run = evaluate('GATE-PLAN', buena);
    expect(run.status).toBe('PASSED');
    expect(run.results.filter((r) => r.outcome === 'NOT_MET')).toEqual([]);
  });

  describe('PLAN-01 Sprint Goal (oficial)', () => {
    it('falla con objetivo vacío o de espacios', () => {
      expect(outcome({ ...buena, sprintGoal: '' }, 'PLAN-01').outcome).toBe('NOT_MET');
      expect(outcome({ ...buena, sprintGoal: '   ' }, 'PLAN-01').outcome).toBe('NOT_MET');
    });
    it('es un criterio oficial y obligatorio', () => {
      const r = outcome(buena, 'PLAN-01');
      expect([r.origin, r.mandatory]).toEqual(['OFFICIAL', true]);
    });
    it('un objetivo vacío hace que la compuerta falle', () => {
      expect(evaluate('GATE-PLAN', { ...buena, sprintGoal: '' }).status).toBe('FAILED');
    });
  });

  describe('PLAN-02 elementos seleccionados (oficial)', () => {
    it('falla sin elementos', () => {
      expect(outcome({ ...buena, items: [] }, 'PLAN-02').outcome).toBe('NOT_MET');
    });
    it('cumple con uno', () => {
      expect(outcome(buena, 'PLAN-02').outcome).toBe('MET');
    });
  });

  describe('PLAN-03 plan de trabajo (oficial)', () => {
    it('falla con plan vacío', () => {
      expect(outcome({ ...buena, workPlan: '  ' }, 'PLAN-03').outcome).toBe('NOT_MET');
    });
  });

  describe('PLAN-04 objetivo comprensible (5 a 40 palabras, sin términos vagos)', () => {
    it.each([
      [4, 'NOT_MET'],
      [5, 'MET'],
      [40, 'MET'],
      [41, 'NOT_MET'],
    ] as const)('%i palabras → %s', (n, esperado) => {
      expect(outcome({ ...buena, sprintGoal: words(n) }, 'PLAN-04').outcome).toBe(esperado);
    });
    it('falla con términos vagos', () => {
      const r = outcome({ ...buena, sprintGoal: 'Hacer que el sistema sea rápido y fácil de usar para todos' }, 'PLAN-04');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toMatch(/rápido|rapido/i);
    });
    it('con objetivo vacío no aplica (lo cubre PLAN-01)', () => {
      expect(outcome({ ...buena, sprintGoal: '' }, 'PLAN-04').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('PLAN-05 coherencia objetivo–trabajo (solapamiento léxico)', () => {
    it('cumple si el objetivo comparte un término significativo con los títulos', () => {
      expect(outcome(buena, 'PLAN-05').outcome).toBe('MET');
    });
    it('ignora mayúsculas, tildes y plurales', () => {
      const s: PlanSnapshot = { ...buena, sprintGoal: 'Lograr que los EQUIPOS gestionen ASISTENCIAS completas del curso', items: [{ ...buena.items[0]!, title: 'Registrar asistencia del equipo' }] };
      expect(outcome(s, 'PLAN-05').outcome).toBe('MET');
    });
    it('falla si no comparten ningún término (tras quitar palabras vacías)', () => {
      const s: PlanSnapshot = { ...buena, sprintGoal: 'Mejorar los reportes mensuales de ventas del negocio entero', items: [{ ...buena.items[0]!, title: 'Registrar asistencia del equipo' }] };
      expect(outcome(s, 'PLAN-05').outcome).toBe('NOT_MET');
    });
    it('palabras vacías compartidas no cuentan', () => {
      const s: PlanSnapshot = { ...buena, sprintGoal: 'Lograr para todos los de la que con', items: [{ ...buena.items[0]!, title: 'Registrar para los del equipo con que' }] };
      expect(outcome(s, 'PLAN-05').outcome).toBe('NOT_MET');
    });
    it('no aplica sin objetivo o sin elementos', () => {
      expect(outcome({ ...buena, sprintGoal: '' }, 'PLAN-05').outcome).toBe('NOT_APPLICABLE');
      expect(outcome({ ...buena, items: [] }, 'PLAN-05').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('PLAN-06 coherencia trabajo–plan (menciona cada elemento)', () => {
    it('cumple si el plan menciona el código o el título', () => {
      expect(outcome({ ...buena, workPlan: 'Haremos HU-1 en la primera semana' }, 'PLAN-06').outcome).toBe('MET');
      expect(outcome({ ...buena, workPlan: 'Primero registrar asistencia del equipo y luego probar' }, 'PLAN-06').outcome).toBe('MET');
    });
    it('falla si algún elemento no se menciona y lo indica', () => {
      const s: PlanSnapshot = {
        ...buena,
        items: [...buena.items, { code: 'HU-2', title: 'Exportar reportes', kind: 'USER_STORY', storyState: 'APROBADA' }],
        workPlan: 'Solo trabajaremos en HU-1 esta semana',
      };
      const r = outcome(s, 'PLAN-06');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toContain('HU-2');
    });
    it('no distingue mayúsculas en el código (hu-1)', () => {
      expect(outcome({ ...buena, workPlan: 'trabajar en hu-1' }, 'PLAN-06').outcome).toBe('MET');
    });
    it('no confunde HU-1 con HU-10', () => {
      const s: PlanSnapshot = { ...buena, workPlan: 'Haremos HU-10 solamente' };
      expect(outcome(s, 'PLAN-06').outcome).toBe('NOT_MET');
    });
    it('no aplica sin plan o sin elementos', () => {
      expect(outcome({ ...buena, workPlan: '' }, 'PLAN-06').outcome).toBe('NOT_APPLICABLE');
      expect(outcome({ ...buena, items: [] }, 'PLAN-06').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('PLAN-07 historias con evaluación aprobada vigente', () => {
    it.each(['NO_EVALUADA', 'NO_APROBADA', 'DESACTUALIZADA'] as const)('falla si una historia está %s', (storyState) => {
      const s: PlanSnapshot = { ...buena, items: [{ ...buena.items[0]!, storyState }] };
      const r = outcome(s, 'PLAN-07');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toContain('HU-1');
    });
    it('cumple si todas las historias están aprobadas', () => {
      expect(outcome(buena, 'PLAN-07').outcome).toBe('MET');
    });
    it('los elementos (ITEM) no cuentan; sin historias no aplica', () => {
      const s: PlanSnapshot = { ...buena, items: [{ code: 'EL-1', title: 'Preparar el entorno de asistencia', kind: 'ITEM', storyState: 'NO_EVALUADA' }], workPlan: 'EL-1 al inicio' };
      expect(outcome(s, 'PLAN-07').outcome).toBe('NOT_APPLICABLE');
    });
  });

  it('el origen oficial/adicional de cada criterio coincide con el catálogo', () => {
    const origenes = Object.fromEntries(evaluate('GATE-PLAN', buena).results.map((r) => [r.criterionId, r.origin]));
    expect(origenes).toEqual({
      'PLAN-01': 'OFFICIAL',
      'PLAN-02': 'OFFICIAL',
      'PLAN-03': 'OFFICIAL',
      'PLAN-04': 'ADDITIONAL',
      'PLAN-05': 'ADDITIONAL',
      'PLAN-06': 'ADDITIONAL',
      'PLAN-07': 'ADDITIONAL',
    });
  });
});
