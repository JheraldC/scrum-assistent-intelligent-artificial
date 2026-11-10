import type { Problem } from '@scrum/shared';
import { es } from '../i18n/es';

/** Error de la API ya tipado: conserva el `Problem` del servidor (mensajes en español). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: Problem | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get code() {
    return this.problem?.code;
  }
  /** Conflicto de versión (FR-036): el cuerpo trae el estado actual en `current`. */
  get current(): unknown {
    return (this.problem as (Problem & { current?: unknown }) | null)?.current;
  }
}

const BASE = '/api/v1';
let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  if (!res.ok) throw await toError(res);
  csrfToken = ((await res.json()) as { csrfToken: string }).csrfToken;
  return csrfToken;
}

/** Descarta el token (p. ej. tras iniciar o cerrar sesión). */
export function resetCsrf(): void {
  csrfToken = null;
}

async function toError(res: Response): Promise<ApiError> {
  let problem: Problem | null = null;
  try {
    problem = (await res.json()) as Problem;
  } catch {
    problem = null;
  }
  return new ApiError(res.status, problem, problem?.message ?? es.errors.generic);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await ensureCsrf();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, null, es.errors.network);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  return (contentType.includes('json') ? await res.json() : await res.text()) as T;
}

/** Sube un archivo (multipart/form-data) con el token CSRF; el navegador fija el límite del cuerpo. */
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-CSRF-Token': await ensureCsrf() },
      credentials: 'include',
      body: form,
    });
  } catch {
    throw new ApiError(0, null, es.errors.network);
  }
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

/** Descarga un archivo del servidor (exportaciones) con la sesión actual y lo guarda en el equipo. */
export async function downloadFile(path: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  } catch {
    throw new ApiError(0, null, es.errors.network);
  }
  if (!res.ok) throw await toError(res);
  const disposition = res.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const filename = (encoded ? decodeURIComponent(encoded) : /filename="([^"]+)"/.exec(disposition)?.[1]) ?? 'exportacion';
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
