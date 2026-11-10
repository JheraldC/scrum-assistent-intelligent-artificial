import { describe, expect, it } from 'vitest';
import { FakeLlmProvider } from '../../../src/modules/agent/llm/index.js';
import { parseAgentOutput } from '../../../src/modules/agent/output.js';

const reply = (extra: object) => JSON.stringify({ type: 'field_recommendations', fields: [], ...extra });

describe('salida de recomendaciones por campo', () => {
  it('acepta los tres estados, valores de texto o lista, criterios y citas', () => {
    const parsed = parseAgentOutput(
      'field_recommendations',
      reply({
        summary: 'Resumen',
        fields: [
          { field: 'title', status: 'CHANGE', proposed: 'Nuevo título', rationale: 'x', criterionIds: ['STORY-03'], sources: [{ document: 'Doc', section: 'Sec' }] },
          { field: 'acceptanceCriteria', status: 'CHANGE', proposed: ['uno', 'dos'] },
          { field: 'asA', status: 'NO_CHANGE', rationale: 'bien' },
          { field: 'iWant', status: 'UNSURE', rationale: 'falta contexto' },
        ],
        questions: ['¿Quién valida?'],
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it.each([
    ['estado desconocido (p. ej. aprobar)', { fields: [{ field: 'title', status: 'APROBAR' }] }],
    ['campo extra no permitido', { fields: [{ field: 'title', status: 'CHANGE', proposed: 'x', asignarA: 'ana' }] }],
    ['identificador de criterio con formato inválido', { fields: [{ field: 'title', status: 'CHANGE', proposed: 'x', criterionIds: ['cualquier cosa'] }] }],
    ['más de 12 campos', { fields: Array.from({ length: 13 }, (_, i) => ({ field: `f${i}`, status: 'NO_CHANGE' })) }],
    ['propiedad desconocida en la raíz', { aprobada: true }],
  ])('rechaza %s', (_caso, extra) => {
    expect(parseAgentOutput('field_recommendations', reply(extra)).ok).toBe(false);
  });

  it('una respuesta de otro tipo no se acepta como recomendación', () => {
    expect(parseAgentOutput('field_recommendations', JSON.stringify({ type: 'chat_reply', answer: 'hola' })).ok).toBe(false);
  });
});

describe('IA simulada de recomendaciones', () => {
  const prompt = (extra = '') =>
    `[TIPO:field_recommendations]\nCampos editables:\n- title (Título; texto)\n- asA (Rol; texto)\n- iWant (Necesidad; texto)\n- acceptanceCriteria (Criterios; lista)\nContenido del artefacto:\ntitle: Mi historia ${extra}\nacceptanceCriteria: - uno - dos`;

  it('responde en el formato esperado, con un cambio, sin cambios y una duda', async () => {
    const llm = new FakeLlmProvider();
    const out = await llm.complete({ system: 's', user: prompt(), maxOutputTokens: 700, temperature: 0 });
    const parsed = parseAgentOutput('field_recommendations', out.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.fields.map((f) => f.status)).toEqual(['CHANGE', 'NO_CHANGE', 'UNSURE', 'CHANGE']);
    expect(parsed.value.fields[3]!.proposed).toEqual(['uno', 'dos', 'Elemento propuesto por la IA simulada']);
  });

  it('con el disparador de «sin cambios» todos los campos quedan sin cambios', async () => {
    const llm = new FakeLlmProvider();
    const out = await llm.complete({ system: 's', user: prompt('SIN-CAMBIOS-IA-SIMULADO'), maxOutputTokens: 700, temperature: 0 });
    const parsed = parseAgentOutput('field_recommendations', out.text);
    expect(parsed.ok && parsed.value.fields.every((f) => f.status === 'NO_CHANGE')).toBe(true);
  });
});
