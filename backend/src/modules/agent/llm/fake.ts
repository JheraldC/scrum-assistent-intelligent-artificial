import { estimateTokens } from '../context.js';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError, type LlmProvider, type LlmRequest, type LlmResponse } from './provider.js';

/** Paso guionizado de la IA simulada (solo para pruebas; nunca es evidencia experimental). */
export type FakeStep =
  | { kind: 'ok'; text: string; inputTokens?: number; outputTokens?: number }
  | { kind: 'error'; error: Error };

/**
 * Proveedor simulado y guionizable. Si no hay pasos en cola responde con JSON válido según el tipo
 * que pide el prompt. Disparadores en el texto del usuario, útiles en pruebas funcionales:
 * `FALLO-IA-SIMULADO`, `TIMEOUT-IA-SIMULADO`, `LIMITE-IA-SIMULADO` y `PROPUESTA-IA-SIMULADA` (devuelve propuestas).
 * La configuración impide usarlo en producción (config.ts).
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake';
  readonly model = 'fake-model-v1';
  readonly calls: LlmRequest[] = [];
  private readonly queue: FakeStep[] = [];

  /** Encola pasos que se consumen uno por llamada, en orden. */
  enqueue(...steps: FakeStep[]): this {
    this.queue.push(...steps);
    return this;
  }

  enqueueText(...texts: string[]): this {
    return this.enqueue(...texts.map((text) => ({ kind: 'ok' as const, text })));
  }

  enqueueError(error: Error): this {
    return this.enqueue({ kind: 'error', error });
  }

  reset(): void {
    this.calls.length = 0;
    this.queue.length = 0;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    const step = this.queue.shift() ?? this.defaultStep(request);
    if (step.kind === 'error') throw step.error;
    return {
      text: step.text,
      model: this.model,
      inputTokens: step.inputTokens ?? estimateTokens(request.system + request.user),
      outputTokens: step.outputTokens ?? estimateTokens(step.text),
      latencyMs: 5,
    };
  }

  private defaultStep(request: LlmRequest): FakeStep {
    const user = request.user;
    if (user.includes('FALLO-IA-SIMULADO')) return { kind: 'error', error: new LlmProviderError('Fallo simulado', 500) };
    if (user.includes('TIMEOUT-IA-SIMULADO')) return { kind: 'error', error: new LlmTimeoutError() };
    if (user.includes('LIMITE-IA-SIMULADO')) return { kind: 'error', error: new LlmRateLimitError(null) };

    if (request.user.includes('[TIPO:field_recommendations]')) {
      const keys = [...user.matchAll(/^- (\w+) \(([^;]+); (texto|lista)\)$/gm)].map((m) => ({ key: m[1]!, kind: m[3]! }));
      const current = (key: string) => new RegExp(`^${key}: (.*)$`, 'm').exec(user)?.[1] ?? '';
      const failed = [...user.matchAll(/^- ([A-Z]+-\d{2}) \(/gm)].map((m) => m[1]!);
      const none = user.includes('SIN-CAMBIOS-IA-SIMULADO');
      const doc = [...user.matchAll(/\[Documento: «([^»]+)» \| Sección: «([^»]+)»\]/g)].find((m) => m[1] !== 'nombre');
      const fields = keys.slice(0, 4).map((k, i) => {
        if (none || i === 1) return { field: k.key, status: 'NO_CHANGE', rationale: 'El valor actual es adecuado (simulado).' };
        if (i === 2) return { field: k.key, status: 'UNSURE', rationale: 'Falta contexto para recomendar sobre este campo (simulado).' };
        const value = current(k.key);
        return {
          field: k.key,
          status: 'CHANGE',
          proposed: k.kind === 'lista' ? [...(value ? value.replace(/^- /, '').split(' - ') : []), 'Elemento propuesto por la IA simulada'] : `${value} (versión revisada por la IA simulada)`.trim(),
          rationale: 'Recomendación simulada para pruebas.',
          ...(failed.length > 0 ? { criterionIds: [failed[0]] } : {}),
          ...(doc ? { sources: [{ document: doc[1], section: doc[2] }] } : {}),
        };
      });
      return { kind: 'ok', text: JSON.stringify({ type: 'field_recommendations', summary: 'Resumen simulado de la recomendación.', fields, questions: ['¿Quién validará este artefacto con el equipo? (simulado)'] }) };
    }

    if (request.user.includes('[TIPO:validation_feedback]')) {
      return {
        kind: 'ok',
        text: JSON.stringify({
          type: 'validation_feedback',
          summary: 'Recomendación simulada para pruebas.',
          observations: [{ criterionId: null, text: 'Revise que el objetivo y el trabajo seleccionado estén alineados.', suggestedRewrite: null }],
        }),
      };
    }
    if (user.includes('PROPUESTA-IA-SIMULADA')) {
      // Propuestas de todos los tipos (y una cita al primer documento si el contexto trae uno).
      const doc = [...user.matchAll(/\[Documento: «([^»]+)» \| Sección: «([^»]+)»\]/g)].find((m) => m[1] !== 'nombre');
      const code = /- (HU-\d+) /.exec(user)?.[1];
      return {
        kind: 'ok',
        text: JSON.stringify({
          type: 'chat_reply',
          answer: 'Respuesta simulada con propuestas revisables.',
          ...(doc ? { basis: 'DOCUMENTO', sources: [{ document: doc[1], section: doc[2] }] } : { basis: 'INFERENCIA' }),
          proposals: [
            {
              kind: 'STORY',
              title: 'Consultar el resumen semanal de asistencia',
              text: 'Propuesta simulada de historia.',
              asA: 'Scrum Master',
              iWant: 'consultar un resumen semanal de la asistencia del equipo',
              soThat: 'puedo detectar ausencias recurrentes a tiempo',
              acceptanceCriteria: ['El resumen muestra la asistencia de cada día de la semana'],
              basis: doc ? 'DOCUMENTO' : 'INFERENCIA',
              ...(doc ? { sources: [{ document: doc[1], section: doc[2] }] } : {}),
            },
            { kind: 'ACCEPTANCE_CRITERIA', text: 'Criterios simulados.', itemCode: code ?? 'HU-1', acceptanceCriteria: ['Se muestra un mensaje claro cuando falta información'] },
            { kind: 'TASK', title: 'Diseñar la pantalla del resumen', text: 'Tarea simulada.', itemCode: code ?? 'HU-1' },
            { kind: 'RISK', text: 'Riesgo simulado: depender de un servicio externo sin plan alterno.' },
            { kind: 'QUESTION', text: 'Pregunta simulada: ¿quién valida el resumen con las personas usuarias?' },
          ],
        }),
      };
    }
    return {
      kind: 'ok',
      text: JSON.stringify({
        type: 'chat_reply',
        answer: 'Respuesta simulada para pruebas: revise los criterios que no se cumplen y corrija primero los obligatorios.',
        suggestions: [{ target: 'artefacto', text: 'Escriba criterios de aceptación que se puedan comprobar con sí o no.' }],
        referencedCriteria: [],
      }),
    };
  }
}
