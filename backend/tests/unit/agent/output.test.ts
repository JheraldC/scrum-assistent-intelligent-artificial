import { describe, expect, it } from 'vitest';
import { parseAgentOutput } from '../../../src/modules/agent/output.js';

const chatOk = { type: 'chat_reply', answer: 'Falta el criterio de aceptación.', suggestions: [{ target: 'HU-1.criterios', text: 'Agregue uno comprobable.' }], referencedCriteria: ['STORY-04'] };
const feedbackOk = { type: 'validation_feedback', summary: 'Resumen', observations: [{ criterionId: 'PLAN-05', text: 'El objetivo parece desalineado.', suggestedRewrite: null }] };

const chat = (raw: string | object) => {
  const r = parseAgentOutput('chat_reply', typeof raw === 'string' ? raw : JSON.stringify(raw));
  if (!r.ok) throw new Error(`se esperaba una respuesta utilizable: ${r.reason}`);
  return r.value;
};

describe('salida del modelo: se sanea en vez de descartarse (T086, FR-024)', () => {
  describe('chat_reply', () => {
    it('acepta una respuesta válida', () => {
      expect(chat(chatOk)).toMatchObject({ type: 'chat_reply', answer: chatOk.answer, referencedCriteria: ['STORY-04'] });
    });

    it('acepta JSON envuelto en un bloque de código o con texto alrededor', () => {
      expect(chat('```json\n' + JSON.stringify(chatOk) + '\n```').answer).toBe(chatOk.answer);
      expect(chat('Claro:\n' + JSON.stringify(chatOk) + '\nEspero que ayude.').answer).toBe(chatOk.answer);
    });

    it('sugerencias y criterios referenciados son opcionales', () => {
      expect(chat({ type: 'chat_reply', answer: 'Hola' })).toEqual({ type: 'chat_reply', answer: 'Hola' });
    });

    it('una respuesta en texto plano (sin JSON) se usa como respuesta: el equipo no se queda sin ayuda', () => {
      expect(chat('Para HU-2 podría empezar por el formulario de inicio de sesión.')).toEqual({
        type: 'chat_reply',
        answer: 'Para HU-2 podría empezar por el formulario de inicio de sesión.',
      });
    });

    it('un JSON cortado (el modelo agotó sus tokens) rescata el texto de la respuesta', () => {
      const cortado = '{"type":"chat_reply","answer":"Plan sugerido:\\n1. Diseñar el formulario\\n2. Validar credenciales","suggestions":[{"target":"HU-2","text":"Empezar por';
      expect(chat(cortado).answer).toBe('Plan sugerido:\n1. Diseñar el formulario\n2. Validar credenciales');
      // También si se corta dentro del propio texto de la respuesta.
      expect(chat('{"type":"chat_reply","answer":"Primero diseñe el formulario y lue').answer).toBe('Primero diseñe el formulario y lue');
    });

    it('las claves desconocidas se ignoran: nunca se obedecen ni llegan a la aplicación', () => {
      const value = chat({ ...chatOk, aprobar: true, gateState: 'APROBADA', proposals: [{ kind: 'TASK', text: 'Hacer algo', assignee: 'ana', estado: 'APROBADA' }] });
      expect(value).not.toHaveProperty('aprobar');
      expect(value).not.toHaveProperty('gateState');
      expect(value.proposals).toEqual([{ kind: 'TASK', text: 'Hacer algo' }]);
    });

    it('recorta lo que excede los límites en vez de fallar', () => {
      const value = chat({
        type: 'chat_reply',
        answer: 'a'.repeat(3500),
        suggestions: Array.from({ length: 8 }, () => ({ target: 't'.repeat(200), text: 'x'.repeat(900) })),
        referencedCriteria: Array.from({ length: 25 }, () => 'STORY-01'),
        proposals: Array.from({ length: 7 }, () => ({ kind: 'RISK', text: 'r'.repeat(900) })),
      });
      expect(value.answer).toHaveLength(3000);
      expect(value.suggestions).toHaveLength(5);
      expect(value.suggestions![0]).toEqual({ target: 't'.repeat(100), text: 'x'.repeat(800) });
      expect(value.referencedCriteria).toHaveLength(20);
      expect(value.proposals).toHaveLength(5);
      expect(value.proposals![0]!.text).toHaveLength(800);
    });

    it('descarta solo las partes inválidas: sugerencias sin texto, criterios mal formados y propuestas de tipo desconocido', () => {
      const value = chat({
        type: 'chat_reply',
        answer: 'Ok',
        suggestions: [{ target: 't' }, { text: 'válida' }, 'texto suelto', 7, null],
        referencedCriteria: ['CRITERIO-1', 'story-04', 'PLAN-02', 12],
        proposals: [{ kind: 'APROBAR', text: 'x' }, { kind: 'plan', text: 'x' }, { kind: 'task', title: 'Diseñar el formulario' }, { kind: 'RISK' }, 'nada'],
        basis: 'CERTEZA',
        sources: [{ document: 'Doc', section: 'Sec' }, { section: 'sin documento' }, 'x'],
      });
      expect(value.suggestions).toEqual([
        { target: '', text: 'válida' },
        { target: '', text: 'texto suelto' },
      ]);
      expect(value.referencedCriteria).toEqual(['PLAN-02']);
      expect(value.proposals).toEqual([{ kind: 'TASK', text: 'Diseñar el formulario', title: 'Diseñar el formulario' }]);
      expect(value).not.toHaveProperty('basis');
      expect(value.sources).toEqual([{ document: 'Doc', section: 'Sec' }]);
    });

    it.each([
      ['cadena vacía', ''],
      ['solo espacios', '   '],
      ['JSON roto sin respuesta rescatable', '{"type":"chat_reply","answer":'],
      ['tipo declarado distinto', JSON.stringify({ ...chatOk, type: 'validation_feedback' })],
      ['respuesta vacía', JSON.stringify({ ...chatOk, answer: '' })],
      ['sin respuesta', JSON.stringify({ type: 'chat_reply', suggestions: [{ target: 't', text: 'x' }] })],
      ['un arreglo en lugar de un objeto', '[1,2,3]'],
    ])('no hay nada utilizable: %s', (_caso, raw) => {
      expect(parseAgentOutput('chat_reply', raw).ok).toBe(false);
    });
  });

  describe('validation_feedback', () => {
    it('acepta una retroalimentación válida, con criterio y reescritura nulos', () => {
      expect(parseAgentOutput('validation_feedback', JSON.stringify(feedbackOk)).ok).toBe(true);
      const r = parseAgentOutput('validation_feedback', JSON.stringify({ type: 'validation_feedback', observations: [{ criterionId: null, text: 'General', suggestedRewrite: null }] }));
      expect(r.ok).toBe(true);
    });

    it('sanea observaciones: recorta, quita las que no tienen texto y anula criterios inválidos', () => {
      const r = parseAgentOutput(
        'validation_feedback',
        JSON.stringify({
          type: 'validation_feedback',
          summary: 'z'.repeat(1200),
          observations: [{ criterionId: 'PLAN-01' }, { criterionId: 'XX-99', text: 'x'.repeat(900), suggestedRewrite: 'y'.repeat(900), extra: 1 }, ...Array.from({ length: 20 }, () => ({ text: 'ok' }))],
        }),
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.summary).toHaveLength(1000);
      expect(r.value.observations).toHaveLength(15);
      expect(r.value.observations[0]).toEqual({ criterionId: null, text: 'x'.repeat(800), suggestedRewrite: 'y'.repeat(800) });
    });

    it.each([
      ['sin observaciones', { type: 'validation_feedback' }],
      ['tipo declarado distinto', { ...feedbackOk, type: 'chat_reply' }],
    ])('no hay nada utilizable: %s', (_caso, objeto) => {
      expect(parseAgentOutput('validation_feedback', JSON.stringify(objeto)).ok).toBe(false);
    });

    it('un texto plano no se acepta como retroalimentación estructurada', () => {
      expect(parseAgentOutput('validation_feedback', 'Todo se ve bien.').ok).toBe(false);
    });
  });

  it('un tipo no esperado se rechaza aunque el JSON sea válido para el otro', () => {
    expect(parseAgentOutput('chat_reply', JSON.stringify(feedbackOk)).ok).toBe(false);
  });

  it('el motivo del rechazo es un mensaje corto, sin contenido del modelo', () => {
    const r = parseAgentOutput('chat_reply', JSON.stringify({ ...chatOk, answer: '', secreto: 'no debe aparecer' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason.length).toBeLessThan(300);
      expect(r.reason).not.toContain('no debe aparecer');
    }
  });
});
