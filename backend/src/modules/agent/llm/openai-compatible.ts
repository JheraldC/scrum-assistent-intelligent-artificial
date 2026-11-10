import { LlmProviderError, LlmRateLimitError, LlmTimeoutError, type LlmProvider, type LlmRequest, type LlmResponse } from './provider.js';

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  providerName?: string;
  /** Esfuerzo de razonamiento para modelos que lo admiten; si no se indica, no se envía. */
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/** Fecha de restablecimiento a partir de cabeceras tipo `1m30s`, `45s` o segundos. */
function parseResetHeader(value: string | null, now: Date): Date | null {
  if (!value) return null;
  const match = /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value.trim());
  const seconds = match && (match[1] || match[2]) ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : Number(value);
  return Number.isFinite(seconds) ? new Date(now.getTime() + seconds * 1000) : null;
}

/**
 * Adaptador para APIs compatibles con el formato de OpenAI (Groq entre ellas), con `fetch` nativo
 * y tiempo límite. La clave solo vive en el servidor y nunca se registra.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  readonly model: string;

  constructor(private readonly options: OpenAiCompatibleOptions) {
    this.name = options.providerName ?? 'openai-compatible';
    this.model = options.model;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          response_format: { type: 'json_object' },
          ...(this.options.reasoningEffort ? { reasoning_effort: this.options.reasoningEffort } : {}),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new LlmTimeoutError();
      throw new LlmProviderError('No se pudo conectar con el proveedor de IA');
    }

    const now = new Date();
    const remaining = response.headers.get('x-ratelimit-remaining-tokens');
    const rateLimit = {
      remainingTokens: remaining !== null && remaining !== '' ? Number(remaining) : null,
      resetAt: parseResetHeader(response.headers.get('x-ratelimit-reset-tokens'), now),
    };

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new LlmRateLimitError(retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : null, rateLimit);
    }
    if (response.status === 400) {
      // Algunos proveedores (Groq) rechazan con 400 cuando el modelo no produjo un JSON válido, pero devuelven
      // lo que generó en `failed_generation`: se entrega ese texto para que la respuesta se pueda sanear y usar.
      const failed = (await response.json().catch(() => null)) as { error?: { failed_generation?: unknown } } | null;
      const generated = failed?.error?.failed_generation;
      if (typeof generated === 'string' && generated.trim() !== '') {
        return { text: generated, model: this.options.model, inputTokens: null, outputTokens: null, latencyMs: Date.now() - started, rateLimit };
      }
      throw new LlmProviderError('El proveedor de IA respondió con el estado 400', 400);
    }
    if (!response.ok) throw new LlmProviderError(`El proveedor de IA respondió con el estado ${response.status}`, response.status);

    let body: { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new LlmProviderError('Respuesta del proveedor de IA ilegible', response.status);
    }
    return {
      text: body.choices?.[0]?.message?.content ?? '',
      model: body.model ?? this.options.model,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started,
      rateLimit,
    };
  }
}
