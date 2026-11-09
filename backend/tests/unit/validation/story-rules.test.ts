import { describe, expect, it } from 'vitest';
import { evaluate, type StorySnapshot } from '../../../src/modules/validation/index.js';

const buena: StorySnapshot = {
  kind: 'USER_STORY',
  title: 'Registrar asistencia del equipo',
  asA: 'Scrum Master',
  iWant: 'registrar la asistencia de cada integrante a la reunión diaria',
  soThat: 'puedo detectar ausencias recurrentes a tiempo',
  description: null,
  acceptanceCriteria: [
    'Se guarda la fecha y la hora del registro de asistencia',
    'Solo el Scrum Master puede modificar un registro ya guardado',
  ],
  priority: 1,
};

function outcome(snapshot: StorySnapshot, id: string) {
  const run = evaluate('GATE-STORY', snapshot);
  return run.results.find((r) => r.criterionId === id)!;
}

describe('reglas de historias STORY-01…08 (T051, FR-009, FR-010)', () => {
  it('una historia bien formada pasa la compuerta con todos los criterios cumplidos', () => {
    const run = evaluate('GATE-STORY', buena);
    expect(run.status).toBe('PASSED');
    expect(run.results.filter((r) => r.outcome === 'NOT_MET')).toEqual([]);
  });

  describe('STORY-01 descripción (oficial)', () => {
    it('falla con título vacío', () => {
      expect(outcome({ ...buena, title: '   ' }, 'STORY-01').outcome).toBe('NOT_MET');
    });
    it('falla en una historia sin texto de necesidad', () => {
      expect(outcome({ ...buena, iWant: '' }, 'STORY-01').outcome).toBe('NOT_MET');
    });
    it('un elemento (ITEM) necesita descripción', () => {
      const item: StorySnapshot = { ...buena, kind: 'ITEM', asA: null, iWant: null, soThat: null, description: '', acceptanceCriteria: [] };
      expect(outcome(item, 'STORY-01').outcome).toBe('NOT_MET');
      expect(outcome({ ...item, description: 'Configurar el entorno de pruebas' }, 'STORY-01').outcome).toBe('MET');
    });
    it('es un criterio oficial y obligatorio', () => {
      const r = outcome(buena, 'STORY-01');
      expect(r.origin).toBe('OFFICIAL');
      expect(r.mandatory).toBe(true);
    });
  });

  describe('STORY-02 orden (oficial, no obligatorio)', () => {
    it('cumple con prioridad ≥ 1 y falla sin ella, sin bloquear', () => {
      expect(outcome(buena, 'STORY-02').outcome).toBe('MET');
      const sinOrden = outcome({ ...buena, priority: 0 }, 'STORY-02');
      expect(sinOrden.outcome).toBe('NOT_MET');
      expect(sinOrden.mandatory).toBe(false);
      expect(evaluate('GATE-STORY', { ...buena, priority: 0 }).status).toBe('PASSED');
    });
  });

  describe('STORY-03 rol, necesidad y beneficio (adicional)', () => {
    it.each([['asA'], ['iWant'], ['soThat']] as const)('falla si falta %s', (campo) => {
      const r = outcome({ ...buena, [campo]: '' }, 'STORY-03');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.origin).toBe('ADDITIONAL');
    });
    it('no aplica a un elemento (ITEM)', () => {
      const item: StorySnapshot = { ...buena, kind: 'ITEM', asA: null, iWant: null, soThat: null, description: 'algo', acceptanceCriteria: [] };
      expect(outcome(item, 'STORY-03').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('STORY-04 criterios de aceptación', () => {
    it('falla sin criterios y sugiere cómo escribirlos', () => {
      const r = outcome({ ...buena, acceptanceCriteria: [] }, 'STORY-04');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.recommendation.length).toBeGreaterThan(10);
    });
    it('los criterios en blanco no cuentan', () => {
      expect(outcome({ ...buena, acceptanceCriteria: ['  ', ''] }, 'STORY-04').outcome).toBe('NOT_MET');
    });
  });

  describe('STORY-05 términos vagos', () => {
    it('detecta términos vagos con mayúsculas y tildes y los indica en la evidencia', () => {
      const r = outcome({ ...buena, iWant: 'que el sistema sea RÁPIDO y fácil de usar' }, 'STORY-05');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.evidence).toMatch(/rápido|rapido/i);
      expect(r.evidence).toMatch(/fácil|facil/i);
    });
    it('detecta vaguedad en los criterios de aceptación', () => {
      const r = outcome({ ...buena, acceptanceCriteria: ['El reporte debe ser intuitivo para todos los usuarios'] }, 'STORY-05');
      expect(r.outcome).toBe('NOT_MET');
    });
    it('un texto sin términos vagos cumple', () => {
      expect(outcome(buena, 'STORY-05').outcome).toBe('MET');
    });
  });

  describe('STORY-06 longitud de criterios (límite en 5 palabras)', () => {
    it('un criterio de 4 palabras falla y uno de 5 cumple', () => {
      expect(outcome({ ...buena, acceptanceCriteria: ['Se guarda la fecha'] }, 'STORY-06').outcome).toBe('NOT_MET');
      expect(outcome({ ...buena, acceptanceCriteria: ['Se guarda la fecha exacta'] }, 'STORY-06').outcome).toBe('MET');
    });
    it('sin criterios no aplica', () => {
      expect(outcome({ ...buena, acceptanceCriteria: [] }, 'STORY-06').outcome).toBe('NOT_APPLICABLE');
    });
  });

  describe('STORY-07 claridad de la necesidad (4 a 40 palabras, no obligatorio)', () => {
    const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
    it.each([
      [3, 'NOT_MET'],
      [4, 'MET'],
      [40, 'MET'],
      [41, 'NOT_MET'],
    ] as const)('%i palabras → %s', (n, esperado) => {
      expect(outcome({ ...buena, iWant: palabras(n) }, 'STORY-07').outcome).toBe(esperado);
    });
    it('no es obligatorio: no impide aprobar', () => {
      expect(evaluate('GATE-STORY', { ...buena, iWant: palabras(3) }).status).toBe('PASSED');
    });
  });

  describe('STORY-08 beneficio distinto de la necesidad (Jaccard < 0,8)', () => {
    it('falla si el beneficio repite la necesidad', () => {
      const r = outcome({ ...buena, iWant: 'registrar la asistencia diaria', soThat: 'registrar la asistencia diaria' }, 'STORY-08');
      expect(r.outcome).toBe('NOT_MET');
    });
    it('cumple con un beneficio distinto', () => {
      expect(outcome(buena, 'STORY-08').outcome).toBe('MET');
    });
  });

  it('una historia ambigua (sin criterios, texto vago) no pasa y reúne todas las observaciones', () => {
    const ambigua: StorySnapshot = { ...buena, iWant: 'algo rápido', acceptanceCriteria: [] };
    const run = evaluate('GATE-STORY', ambigua);
    expect(run.status).toBe('FAILED');
    const fallidos = run.results.filter((r) => r.outcome === 'NOT_MET').map((r) => r.criterionId);
    expect(fallidos).toEqual(expect.arrayContaining(['STORY-04', 'STORY-05']));
    for (const r of run.results.filter((x) => x.outcome === 'NOT_MET')) {
      expect(r.explanation).not.toBe('');
      expect(r.recommendation).not.toBe('');
    }
  });
});
