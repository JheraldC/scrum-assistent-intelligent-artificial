import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Problem, ProblemCode } from '@scrum/shared';

/** Error de aplicación con código de la API, estado HTTP y mensaje en español. */
export class AppError extends Error {
  constructor(
    public readonly code: ProblemCode,
    public readonly status: number,
    message: string,
    public readonly details?: Problem['details'],
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message = 'Los datos enviados no son válidos.', details?: Problem['details']) {
    return new AppError('VALIDATION_ERROR', 422, message, details);
  }
  static unauthenticated(message = 'Debe iniciar sesión.') {
    return new AppError('UNAUTHENTICATED', 401, message);
  }
  static forbidden(message = 'No tiene permiso para realizar esta acción.') {
    return new AppError('FORBIDDEN', 403, message);
  }
  static notFound(message = 'No se encontró el recurso solicitado.') {
    return new AppError('NOT_FOUND', 404, message);
  }
  static conflict(message: string, code: ProblemCode = 'CONFLICT') {
    return new AppError(code, 409, message);
  }
}

const GENERIC_MESSAGES: Record<number, { code: ProblemCode; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'La solicitud no es válida.' },
  401: { code: 'UNAUTHENTICATED', message: 'Debe iniciar sesión.' },
  403: { code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' },
  404: { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.' },
  413: { code: 'VALIDATION_ERROR', message: 'La solicitud es demasiado grande.' },
  415: { code: 'VALIDATION_ERROR', message: 'Formato de contenido no admitido.' },
  429: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente de nuevo en unos instantes.' },
};

function zodDetails(error: ZodError): NonNullable<Problem['details']> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
  }));
}

/** Manejador global: devuelve siempre `Problem` en español, sin trazas ni mensajes internos. */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  const requestId = String(request.id);
  const send = (status: number, body: Omit<Problem, 'requestId'> & Record<string, unknown>) =>
    reply.status(status).type('application/problem+json').send({ ...body, requestId });

  if (error instanceof AppError) {
    return send(error.status, {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(error.extra ?? {}),
    });
  }
  if (error instanceof ZodError) {
    return send(422, { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.', details: zodDetails(error) });
  }

  const fastifyError = error as FastifyError;
  const status = fastifyError.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    const generic = GENERIC_MESSAGES[status] ?? { code: 'VALIDATION_ERROR' as const, message: 'La solicitud no es válida.' };
    // Un cuerpo JSON mal formado u otros errores de entrada se tratan como validación (422).
    const finalStatus = generic.code === 'VALIDATION_ERROR' && status === 400 ? 422 : status;
    return send(finalStatus, generic);
  }

  request.log.error({ err: error }, 'Error interno no controlado');
  return send(500, { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno. Intente de nuevo más tarde.' });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .status(404)
    .type('application/problem+json')
    .send({ code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.', requestId: String(request.id) });
}
