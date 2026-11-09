import { describe, expect, it } from 'vitest';
import { parseAgentOutput } from '../../../src/modules/agent/output.js';

const chatOk = { type: 'chat_reply', answer: 'Falta el criterio de aceptación.', suggestions: [{ target: 'HU-1.criterios', text: 'Agregue uno comprobable.' }], referencedCriteria: ['STORY-04'] };
const feedbackOk = { type: 'validation_feedback', summary: 'Resumen', observations: [{ criterionId: 'PLAN-05', text: 'El objetivo parece desalineado.', suggestedRewrite: null }] };

describe('validación de la salida del modelo (T086, FR-024)', () => {
  describe('chat_reply', () => {
    it('acepta una respuesta válida', () => {
      const r = parseAgentOutput('chat_reply', JSON.stringify(chatOk));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toMatchObject({ type: 'chat_reply', answer: chatOk.answer });
    });

    it('acepta JSON envuelto en un bloque de código', () => {
      const r = parseAgentOutput('chat_reply', '```json\n' + JSON.stringify(chatOk) + '\n```');
      expect(r.ok).toBe(true);
    });

    it('acepta texto antes y después del JSON', () => {
      const r = parseAgentOutput('chat_reply', 'Claro:\n' + JSON.stringify(chatOk) + '\nEspero que ayude.');
      expect(r.ok).toBe(true);
    });

    it('sugerencias y criterios referenciados son opcionales', () => {
      expect(parseAgentOutput('chat_reply', JSON.stringify({ type: 'chat_reply', answer: 'Hola' })).ok).toBe(true);
    });

    it.each([
      ['no es JSON', 'Esto no es JSON'],
      ['cadena vacía', ''],
      ['solo espacios', '   '],
      ['JSON roto', '{"type":"chat_reply","answer":'],
      ['tipo equivocado', JSON.stringify({ ...chatOk, type: 'validation_feedback' })],
      ['respuesta vacía', JSON.stringify({ ...chatOk, answer: '' })],
      ['respuesta de 3001 caracteres', JSON.stringify({ ...chatOk, answer: 'a'.repeat(3001) })],
      ['campo adicional no permitido', JSON.stringify({ ...chatOk, aprobar: true })],
      ['más de 5 sugerencias', JSON.stringify({ ...chatOk, suggestions: Array.from({ length: 6 }, () => ({ target: 't', text: 'x' })) })],
      ['sugerencia sin texto', JSON.stringify({ ...chatOk, suggestions: [{ target: 't' }] })],
      ['texto de sugerencia de 801 caracteres', JSON.stringify({ ...chatOk, suggestions: [{ target: 't', text: 'x'.repeat(801) }] })],
      ['criterio con patrón inválido', JSON.stringify({ ...chatOk, referencedCriteria: ['CRITERIO-1'] })],
      ['criterio en minúsculas', JSON.stringify({ ...chatOk, referencedCriteria: ['story-04'] })],
      ['más de 20 criterios', JSON.stringify({ ...chatOk, referencedCriteria: Array.from({ length: 21 }, () => 'STORY-01') })],
    ])('rechaza: %s', (_caso, raw) => {
      const r = parseAgentOutput('chat_reply', raw);
      expect(r.ok).toBe(false);
    });

    it('acepta los límites exactos (3000 caracteres, 5 sugerencias, 20 criterios)', () => {
      const exacto = {
        type: 'chat_reply',
        answer: 'a'.repeat(3000),
        suggestions: Array.from({ length: 5 }, () => ({ target: 't', text: 'x'.repeat(800) })),
        referencedCriteria: Array.from({ length: 20 }, () => 'STORY-01'),
      };
      expect(parseAgentOutput('chat_reply', JSON.stringify(exacto)).ok).toBe(true);
    });
  });

  describe('validation_feedback', () => {
    it('acepta una retroalimentación válida', () => {
      expect(parseAgentOutput('validation_feedback', JSON.stringify(feedbackOk)).ok).toBe(true);
    });
    it.each([
      ['más de 15 observaciones', { ...feedbackOk, observations: Array.from({ length: 16 }, () => ({ text: 'x' })) }],
      ['observación sin texto', { ...feedbackOk, observations: [{ criterionId: 'PLAN-01' }] }],
      ['texto de observación de 801 caracteres', { ...feedbackOk, observations: [{ text: 'x'.repeat(801) }] }],
      ['reescritura de 801 caracteres', { ...feedbackOk, observations: [{ text: 'x', suggestedRewrite: 'y'.repeat(801) }] }],
      ['resumen de 1001 caracteres', { ...feedbackOk, summary: 'z'.repeat(1001) }],
      ['criterio inválido', { ...feedbackOk, observations: [{ criterionId: 'XX-99', text: 'x' }] }],
      ['sin observaciones (campo requerido)', { type: 'validation_feedback' }],
      ['tipo equivocado', { ...feedbackOk, type: 'chat_reply' }],
    ])('rechaza: %s', (_caso, objeto) => {
      expect(parseAgentOutput('validation_feedback', JSON.stringify(objeto)).ok).toBe(false);
    });
    it('acepta criterionId nulo y reescritura nula', () => {
      const r = parseAgentOutput('validation_feedback', JSON.stringify({ type: 'validation_feedback', observations: [{ criterionId: null, text: 'General', suggestedRewrite: null }] }));
      expect(r.ok).toBe(true);
    });
  });

  it('un tipo no esperado se rechaza aunque el JSON sea válido para el otro', () => {
    expect(parseAgentOutput('chat_reply', JSON.stringify(feedbackOk)).ok).toBe(false);
  });

  it('el motivo del rechazo es un mensaje corto, sin contenido sensible', () => {
    const r = parseAgentOutput('chat_reply', JSON.stringify({ ...chatOk, answer: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeLessThan(300);
  });
});
