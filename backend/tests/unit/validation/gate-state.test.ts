import { describe, expect, it } from 'vitest';
import { deriveGateState } from '../../../src/modules/validation/index.js';

describe('estado derivado de la compuerta (T053)', () => {
  it('sin evaluaciones: NO_EVALUADA', () => {
    expect(deriveGateState(null, 1)).toBe('NO_EVALUADA');
  });

  it('última evaluación PASSED con la versión actual: APROBADA', () => {
    expect(deriveGateState({ status: 'PASSED', targetVersion: 3, hasException: false }, 3)).toBe('APROBADA');
  });

  it('última evaluación FAILED con la versión actual: NO_APROBADA', () => {
    expect(deriveGateState({ status: 'FAILED', targetVersion: 3, hasException: false }, 3)).toBe('NO_APROBADA');
  });

  it('FAILED con excepción vigente: APROBADA_CON_EXCEPCION', () => {
    expect(deriveGateState({ status: 'FAILED', targetVersion: 3, hasException: true }, 3)).toBe('APROBADA_CON_EXCEPCION');
  });

  it('si el artefacto cambió de versión: DESACTUALIZADA (aunque estuviera aprobado)', () => {
    expect(deriveGateState({ status: 'PASSED', targetVersion: 2, hasException: false }, 3)).toBe('DESACTUALIZADA');
    expect(deriveGateState({ status: 'FAILED', targetVersion: 2, hasException: true }, 3)).toBe('DESACTUALIZADA');
  });

  it('una evaluación con ERROR nunca aprueba: queda NO_APROBADA', () => {
    expect(deriveGateState({ status: 'ERROR', targetVersion: 3, hasException: false }, 3)).toBe('NO_APROBADA');
  });

  it('una excepción no convierte en aprobada una evaluación PASSED ni una ERROR sin más', () => {
    expect(deriveGateState({ status: 'PASSED', targetVersion: 1, hasException: true }, 1)).toBe('APROBADA');
    expect(deriveGateState({ status: 'ERROR', targetVersion: 1, hasException: true }, 1)).toBe('NO_APROBADA');
  });
});
