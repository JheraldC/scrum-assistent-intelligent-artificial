import type { FastifyServerOptions } from 'fastify';

// pino en JSON con redacción de datos sensibles (plan.md, "Manejo de errores y registros").
// No se registra el contenido de preguntas ni de artefactos.
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.email',
  '*.api_key',
  '*.apiKey',
  '*.token',
];

export function loggerOptions(level: string): NonNullable<FastifyServerOptions['logger']> {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };
}
