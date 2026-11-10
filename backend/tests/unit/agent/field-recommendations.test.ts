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

  it('sanea: descarta entradas con estado desconocido, ignora campos extra y criterios mal formados, y limita a 12', () => {
    const parsed = parseAgentOutput(
      'field_recommendations',
      reply({
        aprobada: true,
        fields: [
          { field: 'title', status: 'APROBAR' },
          { field: 'asA', status: 'change', proposed: 'x', asignarA: 'ana', criterionIds: ['cualquier cosa', 'STORY-03'] },
          ...Array.from({ length: 13 }, (_, i) => ({ field: `f${i}`, status: 'NO_CHANGE' })),
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).not.toHaveProperty('aprobada');
    expect(parsed.value.fields).toHaveLength(12);
    expect(parsed.value.fields[0]).toEqual({ field: 'asA', status: 'CHANGE', proposed: 'x', criterionIds: ['STORY-03'] });
    expect(parsed.value.fields.some((f) => f.field === 'title')).toBe(false); // «aprobar» no es un estado válido
  });

  it('sin la lista de campos, o con texto plano, no hay nada utilizable', () => {
    expect(parseAgentOutput('field_recommendations', JSON.stringify({ type: 'field_recommendations', summary: 'x' })).ok).toBe(false);
    expect(parseAgentOutput('field_recommendations', 'Todo bien.').ok).toBe(false);
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
