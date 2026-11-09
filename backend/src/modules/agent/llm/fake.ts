import { estimateTokens } from '../context.js';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError, type LlmProvider, type LlmRequest, type LlmResponse } from './provider.js';

/** Paso guionizado de la IA simulada (solo para pruebas; nunca es evidencia experimental). */
export type FakeStep =
  | { kind: 'ok'; text: string; inputTokens?: number; outputTokens?: number }
  | { kind: 'error'; error: Error };

/**
 * Proveedor simulado y guionizable. Si no hay pasos en cola responde con JSON válido según el tipo
 * que pide el prompt. Disparadores en el texto del usuario, útiles en pruebas funcionales:
 * `FALLO-IA-SIMULADO`, `TIMEOUT-IA-SIMULADO` y `LIMITE-IA-SIMULADO`.
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
