import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmProviderError, LlmRateLimitError } from '../../../src/modules/agent/llm/index.js';
import { OpenAiCompatibleProvider } from '../../../src/modules/agent/llm/openai-compatible.js';

// El proveedor real nunca se llama en las pruebas: `fetch` se sustituye por respuestas preparadas.
const request = { system: 'sistema', user: 'usuario', maxOutputTokens: 1500, temperature: 0.2 };
const base = { baseUrl: 'https://proveedor.invalid/v1/', apiKey: 'clave-de-prueba', model: 'modelo-x', timeoutMs: 1000 };

function stubFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const mock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const sentBody = (mock: ReturnType<typeof stubFetch>) => JSON.parse(String((mock.mock.calls[0] as unknown as [string, { body: string }])[1].body)) as Record<string, unknown>;

describe('adaptador compatible con OpenAI', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envía modelo, mensajes, formato JSON y límites; no envía esfuerzo de razonamiento si no se configuró', async () => {
    const mock = stubFetch(200, { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'modelo-x' });
    const out = await new OpenAiCompatibleProvider(base).complete(request);
    expect(out).toMatchObject({ text: '{"ok":true}', inputTokens: 10, outputTokens: 5, model: 'modelo-x' });
    const body = sentBody(mock);
    expect(body).toMatchObject({ model: 'modelo-x', max_tokens: 1500, temperature: 0.2, response_format: { type: 'json_object' } });
    expect(body).not.toHaveProperty('reasoning_effort');
    expect((mock.mock.calls[0] as unknown as [string])[0]).toBe('https://proveedor.invalid/v1/chat/completions');
  });

  it('con LLM_REASONING_EFFORT configurado lo envía (modelos con razonamiento)', async () => {
    const mock = stubFetch(200, { choices: [{ message: { content: '{}' } }] });
    await new OpenAiCompatibleProvider({ ...base, reasoningEffort: 'low' }).complete(request);
    expect(sentBody(mock).reasoning_effort).toBe('low');
  });

  it('un 400 por JSON mal generado devuelve el texto que el modelo sí produjo, para poder sanearlo', async () => {
    stubFetch(400, { error: { code: 'json_validate_failed', failed_generation: 'Plan sugerido: diseñar el formulario.' } });
    const out = await new OpenAiCompatibleProvider(base).complete(request);
    expect(out.text).toBe('Plan sugerido: diseñar el formulario.');
  });

  it('otros 400 y los 5xx son errores del proveedor; el 429 es límite de uso', async () => {
    stubFetch(400, { error: { message: 'modelo inexistente' } });
    await expect(new OpenAiCompatibleProvider(base).complete(request)).rejects.toBeInstanceOf(LlmProviderError);
    stubFetch(503, {});
    await expect(new OpenAiCompatibleProvider(base).complete(request)).rejects.toBeInstanceOf(LlmProviderError);
    stubFetch(429, {}, { 'retry-after': '2' });
    await expect(new OpenAiCompatibleProvider(base).complete(request)).rejects.toBeInstanceOf(LlmRateLimitError);
  });

  it('una respuesta sin contenido devuelve texto vacío (el servicio la trata como inválida)', async () => {
    stubFetch(200, { choices: [] });
    expect((await new OpenAiCompatibleProvider(base).complete(request)).text).toBe('');
  });
});
