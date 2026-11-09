import { ApiError } from './client';
import { es } from '../i18n/es';

export interface FormFailure {
  message: string;
  fields: Record<string, string>;
}

/** Convierte un error de la API en un mensaje general y errores por campo (mensajes en español). */
export function toFormFailure(error: unknown): FormFailure {
  if (error instanceof ApiError) {
    const fields: Record<string, string> = {};
    for (const detail of error.problem?.details ?? []) {
      if (detail.field && !fields[detail.field]) fields[detail.field] = detail.message;
    }
    return { message: error.message, fields };
  }
  return { message: es.errors.generic, fields: {} };
}
