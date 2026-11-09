import { describe, expect, it } from 'vitest';
import { nextStageStatus, type StageEvent } from '../../../src/modules/sprints/index.js';
import type { StageStatus } from '@scrum/shared';

describe('transiciones de etapa (T071, data-model.md "Etapa")', () => {
  const validas: [StageStatus, StageEvent, StageStatus][] = [
    ['PENDING', 'edit', 'IN_PROGRESS'],
    ['PENDING', 'start', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'gate_failed', 'NEEDS_CORRECTION'],
    ['NEEDS_CORRECTION', 'edit', 'IN_PROGRESS'],
    ['NEEDS_CORRECTION', 'gate_passed', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'complete', 'VALIDATED'],
    ['VALIDATED', 'edit', 'NEEDS_CORRECTION'],
    // Idempotentes
    ['IN_PROGRESS', 'edit', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'gate_passed', 'IN_PROGRESS'],
    ['NEEDS_CORRECTION', 'gate_failed', 'NEEDS_CORRECTION'],
    ['VALIDATED', 'gate_passed', 'VALIDATED'],
  ];
  it.each(validas)('%s + %s → %s', (from, event, to) => {
    expect(nextStageStatus(from, event)).toBe(to);
  });

  const invalidas: [StageStatus, StageEvent][] = [
    ['PENDING', 'complete'],
    ['PENDING', 'gate_failed'],
    ['NEEDS_CORRECTION', 'complete'],
    ['VALIDATED', 'complete'],
    ['VALIDATED', 'start'],
    ['IN_PROGRESS', 'start'],
    ['VALIDATED', 'gate_failed'],
  ];
  it.each(invalidas)('%s + %s no está permitida (null)', (from, event) => {
    expect(nextStageStatus(from, event)).toBeNull();
  });

  it('cubre todas las combinaciones sin lanzar errores', () => {
    const estados: StageStatus[] = ['PENDING', 'IN_PROGRESS', 'NEEDS_CORRECTION', 'VALIDATED'];
    const eventos: StageEvent[] = ['start', 'edit', 'gate_failed', 'gate_passed', 'complete'];
    for (const e of estados) for (const ev of eventos) expect(() => nextStageStatus(e, ev)).not.toThrow();
  });
});
