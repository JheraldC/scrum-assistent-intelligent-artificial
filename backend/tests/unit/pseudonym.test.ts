import { describe, expect, it } from 'vitest';
import { PSEUDONYM_PATTERN } from '@scrum/shared';
import { generatePseudonym } from '../../src/modules/auth/pseudonym.js';

describe('generador de seudónimos (T025)', () => {
  it('produce el patrón ^P-[A-Z2-9]{6}$', () => {
    for (let i = 0; i < 500; i += 1) expect(generatePseudonym()).toMatch(PSEUDONYM_PATTERN);
  });

  it('no usa caracteres ambiguos (I, O, 0, 1)', () => {
    for (let i = 0; i < 500; i += 1) expect(generatePseudonym().slice(2)).not.toMatch(/[IO01]/);
  });

  it('es aleatorio: no repite en una muestra razonable', () => {
    const sample = new Set(Array.from({ length: 300 }, () => generatePseudonym()));
    expect(sample.size).toBeGreaterThan(295);
  });
});
