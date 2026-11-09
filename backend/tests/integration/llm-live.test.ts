import { describe, expect, it } from 'vitest';
import { OpenAiCompatibleProvider } from '../../src/modules/agent/llm/openai-compatible.js';
import { parseAgentOutput } from '../../src/modules/agent/output.js';
import { PROMPTS } from '../../src/modules/agent/prompts/index.js';

/**
 * Prueba de contrato con el proveedor REAL (T092). Se omite salvo `LLM_LIVE_TESTS=1` y con las
 * variables LLM_BASE_URL, LLM_API_KEY y LLM_MODEL definidas. No corre en CI y consume cupo.
 */
const live = process.env.LLM_LIVE_TESTS === '1';

describe.skipIf(!live)('proveedor de IA real (contrato de formato)', () => {
  const provider = () =>
    new OpenAiCompatibleProvider({
      baseUrl: process.env.LLM_BASE_URL!,
      apiKey: process.env.LLM_API_KEY!,
      model: process.env.LLM_MODEL!,
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 20_000),
    });

  it('devuelve un JSON de chat_reply que cumple el esquema', async () => {
    const response = await provider().complete({
      system: PROMPTS.system,
      user: `${PROMPTS.chat}\n\n<datos_proyecto>\nObjetivo del producto: Ayudar a equipos novatos a practicar Scrum\n</datos_proyecto>\n<datos_usuario>\n¿Qué es un Sprint Goal?\n</datos_usuario>`,
      maxOutputTokens: 600,
      temperature: 0.2,
    });
    const parsed = parseAgentOutput('chat_reply', response.text);
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
    expect(response.model).toBeTruthy();
    expect(response.inputTokens).not.toBeNull();
  }, 60_000);

  it('devuelve un JSON de validation_feedback que cumple el esquema', async () => {
    const response = await provider().complete({
      system: PROMPTS.system,
      user: `${PROMPTS.validationFeedback}\n\n<datos_proyecto>\nObjetivo del producto: Ayudar a equipos novatos\nContenido del artefacto:\nsprintGoal: Mejorar cosas\nCriterios no cumplidos:\n- PLAN-04 (Criterio adicional del prototipo) Objetivo comprensible: usa términos vagos\n</datos_proyecto>\n<datos_usuario>\nEscribe observaciones asesoras.\n</datos_usuario>`,
      maxOutputTokens: 600,
      temperature: 0.2,
    });
    const parsed = parseAgentOutput('validation_feedback', response.text);
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
  }, 60_000);
});
