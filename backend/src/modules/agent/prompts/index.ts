import { readFileSync } from 'node:fs';

/**
 * Prompts versionados (research.md D-10). Cambiar un prompt exige crear la carpeta `v2/` y subir
 * `PROMPT_VERSION`, para poder reproducir cada evaluación con el prompt exacto que se usó.
 */
export const PROMPT_VERSION = 'v1';

const load = (name: string): string => readFileSync(new URL(`./${PROMPT_VERSION}/${name}`, import.meta.url), 'utf8');

export const PROMPTS = {
  system: load('system.md'),
  chat: load('chat.md'),
  validationFeedback: load('validation-feedback.md'),
} as const;
