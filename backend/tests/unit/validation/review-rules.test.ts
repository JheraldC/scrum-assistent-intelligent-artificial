import { describe, expect, it } from 'vitest';
import { evaluate, getGate, type ReviewSnapshot } from '../../../src/modules/validation/index.js';

const buena: ReviewSnapshot = {
  results: 'Se completaron 3 de las 4 historias seleccionadas.',
  increment: 'El formulario de asistencia ya registra la fecha y la hora.',
  feedback: 'El profesor sugirió mostrar un resumen semanal de ausencias.',
  goalAssessment: 'PARTIAL',
  goalAssessmentNote: 'Se logró el registro pero faltó el panel de resumen.',
};

const outcome = (s: ReviewSnapshot, id: string) => evaluate('GATE-REVIEW', s).results.find((r) => r.criterionId === id)!;

describe('reglas de la Sprint Review REV-01…04 (T127, FR-039)', () => {
  it('una Review completa pasa la evaluación', () => {
    const run = evaluate('GATE-REVIEW', buena);
    expect(run.status).toBe('PASSED');
    expect(run.results.map((r) => r.outcome)).toEqual(['MET', 'MET', 'MET', 'MET']);
  });

  it('la compuerta de la Review no bloquea el avance (control orientativo)', () => {
    expect(getGate('GATE-REVIEW')?.blocking).toBe(false);
  });

  describe('REV-01 se registraron resultados (oficial)', () => {
    it.each([[''], ['   '], ['\n\t']])('falla con resultados vacíos (%j)', (results) => {
      const r = outcome({ ...buena, results }, 'REV-01');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.explanation).not.toBe('');
      expect(r.recommendation).not.toBe('');
    });
    it('es oficial', () => {
      expect(outcome(buena, 'REV-01').origin).toBe('OFFICIAL');
    });
  });

  describe('REV-02 se describe el incremento (oficial)', () => {
    it('falla con incremento vacío', () => {
      expect(outcome({ ...buena, increment: '' }, 'REV-02').outcome).toBe('NOT_MET');
    });
    it('cumple con texto', () => {
      expect(outcome(buena, 'REV-02').outcome).toBe('MET');
      expect(outcome(buena, 'REV-02').origin).toBe('OFFICIAL');
    });
  });

  describe('REV-03 relación con el Sprint Goal (adicional)', () => {
    it('falla si no hay valoración', () => {
      const r = outcome({ ...buena, goalAssessment: null }, 'REV-03');
      expect(r.outcome).toBe('NOT_MET');
      expect(r.recommendation).toMatch(/Sprint Goal|objetivo/i);
    });
    it('falla si hay valoración pero falta el texto que la explica', () => {
      expect(outcome({ ...buena, goalAssessmentNote: '  ' }, 'REV-03').outcome).toBe('NOT_MET');
    });
    it.each(['ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED'] as const)('cumple con valoración %s y explicación', (goalAssessment) => {
      expect(outcome({ ...buena, goalAssessment }, 'REV-03').outcome).toBe('MET');
    });
    it('es un criterio adicional del prototipo', () => {
      expect(outcome(buena, 'REV-03').origin).toBe('ADDITIONAL');
    });
  });

  describe('REV-04 se registró retroalimentación (oficial)', () => {
    it('falla sin retroalimentación', () => {
      expect(outcome({ ...buena, feedback: '' }, 'REV-04').outcome).toBe('NOT_MET');
    });
  });

  it('una Review vacía falla y reúne todas las observaciones con su explicación y recomendación', () => {
    const run = evaluate('GATE-REVIEW', { results: '', increment: '', feedback: '', goalAssessment: null, goalAssessmentNote: '' });
    expect(run.status).toBe('FAILED');
    expect(run.results.every((r) => r.outcome === 'NOT_MET')).toBe(true);
    for (const r of run.results) {
      expect(r.explanation).not.toBe('');
      expect(r.recommendation).not.toBe('');
    }
  });

  it('es determinista', () => {
    expect(evaluate('GATE-REVIEW', buena)).toEqual(evaluate('GATE-REVIEW', structuredClone(buena)));
  });
});
