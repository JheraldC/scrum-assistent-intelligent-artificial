import type { Config } from '../../../platform/config.js';
import { FakeLlmProvider } from './fake.js';
import { OpenAiCompatibleProvider } from './openai-compatible.js';
import type { LlmProvider } from './provider.js';

export * from './provider.js';
export { FakeLlmProvider } from './fake.js';

/** Crea el proveedor según LLM_PROVIDER (proveedor y modelo configurables por entorno). */
export function createLlmProvider(config: Config): LlmProvider {
  if (config.LLM_PROVIDER === 'fake') return new FakeLlmProvider();
  return new OpenAiCompatibleProvider({
    baseUrl: config.LLM_BASE_URL!,
    apiKey: config.LLM_API_KEY!,
    model: config.LLM_MODEL!,
    timeoutMs: config.LLM_TIMEOUT_MS,
    reasoningEffort: config.LLM_REASONING_EFFORT,
  });
}
