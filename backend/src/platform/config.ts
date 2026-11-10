import { z } from 'zod';

// Variables de entorno validadas al arrancar (plan.md, "Agente inteligente").
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default('')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

    LLM_PROVIDER: z.enum(['fake', 'openai-compatible']).default('fake'),
    LLM_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
    LLM_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    LLM_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
    // Los modelos con razonamiento gastan parte de este límite antes de responder: 700 cortaba las respuestas.
    LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1500),
    // Opcional: esfuerzo de razonamiento (solo modelos que lo admiten, p. ej. gpt-oss en Groq). Vacío = no se envía.
    LLM_REASONING_EFFORT: z.preprocess(emptyToUndefined, z.enum(['low', 'medium', 'high']).optional()),
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),

    AI_USER_RATE_PER_MINUTE: z.coerce.number().int().positive().default(10),
    AI_DAILY_TOKEN_BUDGET_GLOBAL: z.coerce.number().int().positive().default(170_000),
    AI_DAILY_TOKEN_BUDGET_PER_PROJECT: z.coerce.number().int().positive().default(40_000),
  })
  .superRefine((env, ctx) => {
    // El proveedor simulado solo existe para pruebas: nunca en producción (Principio V).
    if (env.NODE_ENV === 'production' && env.LLM_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['LLM_PROVIDER'],
        message: 'LLM_PROVIDER=fake está prohibido en producción',
      });
    }
    if (env.LLM_PROVIDER === 'openai-compatible') {
      for (const key of ['LLM_MODEL', 'LLM_API_KEY', 'LLM_BASE_URL'] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: `${key} es obligatoria con openai-compatible` });
        }
      }
    }
  });

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `- ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Configuración de entorno inválida:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
