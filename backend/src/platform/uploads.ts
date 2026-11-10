import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

/**
 * Validación de archivos subidos. El tipo se decide por una lista cerrada de extensiones y se
 * confirma con el contenido (firma binaria o texto UTF-8 válido): nunca se confía en el
 * `Content-Type` ni en el nombre que envía el cliente. Los archivos se guardan en la base de datos
 * (privados) y se sirven siempre como descarga con un tipo fijo.
 */
export const MB = 1024 * 1024;

export interface AllowedType {
  mime: string;
  kind: 'text' | 'pdf' | 'png' | 'jpeg';
}

export const DOCUMENT_TYPES: Record<string, AllowedType> = {
  md: { mime: 'text/markdown; charset=utf-8', kind: 'text' },
  txt: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  pdf: { mime: 'application/pdf', kind: 'pdf' },
};

export const EVIDENCE_TYPES: Record<string, AllowedType> = {
  ...DOCUMENT_TYPES,
  png: { mime: 'image/png', kind: 'png' },
  jpg: { mime: 'image/jpeg', kind: 'jpeg' },
  jpeg: { mime: 'image/jpeg', kind: 'jpeg' },
};

export interface ValidatedUpload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  /** Solo para archivos de texto. */
  text: string | null;
}

/** Nombre seguro: sin rutas ni caracteres de control, de hasta 120 caracteres. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- eliminar caracteres de control es el objetivo
  const cleaned = base.replace(/[\u0000-\u001F\u007F"<>:|?*]/g, '').trim();
  return cleaned.slice(-120) || 'archivo';
}

function startsWith(data: Buffer, bytes: number[]): boolean {
  return bytes.every((b, i) => data[i] === b);
}

export function validateUpload(fileName: string, data: Buffer, allowed: Record<string, AllowedType>, maxBytes: number): ValidatedUpload {
  const name = safeFileName(fileName);
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const type = allowed[ext];
  const accepted = Object.keys(allowed).map((e) => `.${e}`).join(', ');
  if (!type) throw AppError.validation(`Tipo de archivo no admitido. Formatos permitidos: ${accepted}.`, [{ field: 'file', message: 'Tipo de archivo no admitido.' }]);
  if (data.length === 0) throw AppError.validation('El archivo está vacío.', [{ field: 'file', message: 'El archivo está vacío.' }]);
  if (data.length > maxBytes) {
    throw AppError.validation(`El archivo supera el tamaño máximo de ${Math.floor(maxBytes / MB)} MB.`, [{ field: 'file', message: 'El archivo es demasiado grande.' }]);
  }

  let valid = false;
  let text: string | null = null;
  switch (type.kind) {
    case 'pdf':
      valid = startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      break;
    case 'png':
      valid = startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case 'jpeg':
      valid = startsWith(data, [0xff, 0xd8, 0xff]);
      break;
    case 'text':
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(data);
        valid = !decoded.includes('\u0000');
        text = valid ? (decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded) : null;
      } catch {
        valid = false;
      }
      break;
  }
  if (!valid) {
    throw AppError.validation('El contenido del archivo no corresponde a su extensión.', [{ field: 'file', message: 'El contenido no corresponde a la extensión.' }]);
  }
  return { fileName: name, mimeType: type.mime, sizeBytes: data.length, data, text };
}

export interface ReceivedUpload {
  fields: Record<string, string>;
  file: { fileName: string; data: Buffer } | null;
}

/** Lee un cuerpo `multipart/form-data` con un único archivo y campos de texto cortos. */
export async function readUpload(request: FastifyRequest, maxBytes: number): Promise<ReceivedUpload> {
  if (!request.isMultipart()) throw AppError.validation('Envíe el archivo como multipart/form-data.');
  const fields: Record<string, string> = {};
  let file: ReceivedUpload['file'] = null;
  try {
    for await (const part of request.parts({ limits: { fileSize: maxBytes, files: 1, fields: 5, fieldSize: 4000 } })) {
      if (part.type === 'file') {
        const data = await part.toBuffer(); // lanza si supera el límite
        if (part.file.truncated) throw new Error('truncated');
        file = { fileName: part.filename, data };
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.validation(`El archivo supera el tamaño máximo de ${Math.floor(maxBytes / MB)} MB o la solicitud no es válida.`, [
      { field: 'file', message: 'El archivo es demasiado grande o la solicitud no es válida.' },
    ]);
  }
  return { fields, file };
}
