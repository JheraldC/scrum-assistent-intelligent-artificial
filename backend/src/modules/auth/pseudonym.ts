import { randomInt } from 'node:crypto';
import { PSEUDONYM_PATTERN } from '@scrum/shared';

// Alfabeto sin caracteres ambiguos (sin I ni O); todos dentro de A-Z y 2-9.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Seudónimo aleatorio `P-XXXXXX`; no deriva del correo ni del nombre (research.md D-05). */
export function generatePseudonym(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  const pseudonym = `P-${code}`;
  if (!PSEUDONYM_PATTERN.test(pseudonym)) throw new Error('Seudónimo generado con formato inválido');
  return pseudonym;
}
