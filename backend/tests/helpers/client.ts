import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  /** `false` omite el token CSRF; una cadena envía ese valor en su lugar. */
  csrf?: boolean | string;
  headers?: Record<string, string>;
}

/** Cliente de pruebas con jarra de cookies y token CSRF, como un navegador. */
export class TestClient {
  readonly cookies = new Map<string, string>();
  private csrf: string | undefined;

  constructor(private readonly app: FastifyInstance) {}

  private cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: LightMyRequestResponse): void {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const line of list) {
      const [pair = '', ...attrs] = line.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const expired = attrs.some((a) => /^max-age=0$/i.test(a)) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async csrfToken(): Promise<string> {
    if (!this.csrf) {
      const res = await this.send('GET', '/api/v1/auth/csrf');
      this.csrf = (res.json() as { csrfToken: string }).csrfToken;
    }
    return this.csrf;
  }

  private async send(method: Method, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await this.app.inject({
      method,
      url,
      headers: { ...(this.cookies.size ? { cookie: this.cookieHeader() } : {}), ...headers },
      ...(body !== undefined ? { payload: body as object } : {}),
    });
    this.absorb(res);
    return res;
  }

  async request(method: Method, url: string, body?: unknown, options: RequestOptions = {}) {
    const headers: Record<string, string> = { ...options.headers };
    if (method !== 'GET') {
      if (typeof options.csrf === 'string') headers['x-csrf-token'] = options.csrf;
      else if (options.csrf !== false) headers['x-csrf-token'] = await this.csrfToken();
    }
    return this.send(method, `/api/v1${url}`.replace('/api/v1/api/v1', '/api/v1'), body, headers);
  }

  get = (url: string, options?: RequestOptions) => this.request('GET', url, undefined, options);
  post = (url: string, body?: unknown, options?: RequestOptions) => this.request('POST', url, body ?? {}, options);
  put = (url: string, body?: unknown, options?: RequestOptions) => this.request('PUT', url, body ?? {}, options);
  patch = (url: string, body?: unknown, options?: RequestOptions) => this.request('PATCH', url, body ?? {}, options);
  delete = (url: string, options?: RequestOptions) => this.request('DELETE', url, undefined, options);

  /** Envía un archivo como multipart/form-data (con token CSRF), como lo haría el navegador. */
  async upload(
    url: string,
    file: { name: string; data: Buffer | string },
    fields: Record<string, string> = {},
    options: { method?: Method; csrf?: boolean } = {},
  ) {
    const CRLF = '\r\n';
    const boundary = `----prueba${Math.random().toString(16).slice(2)}`;
    const chunks: Buffer[] = [];
    for (const [key, value] of Object.entries(fields)) {
      chunks.push(Buffer.from(['--' + boundary, `Content-Disposition: form-data; name="${key}"`, '', value, ''].join(CRLF)));
    }
    chunks.push(
      Buffer.from(
        ['--' + boundary, `Content-Disposition: form-data; name="file"; filename="${file.name}"`, 'Content-Type: application/octet-stream', '', ''].join(CRLF),
      ),
    );
    chunks.push(Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data));
    chunks.push(Buffer.from(CRLF + '--' + boundary + '--' + CRLF));
    const headers: Record<string, string> = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    if (options.csrf !== false) headers['x-csrf-token'] = await this.csrfToken();
    return this.send(options.method ?? 'POST', `/api/v1${url}`, Buffer.concat(chunks), headers);
  }

  async login(email: string, password: string) {
    const res = await this.post('/auth/login', { email, password });
    this.csrf = undefined; // la sesión nueva cambia la semilla del token CSRF
    return res;
  }

  async logout() {
    const res = await this.post('/auth/logout');
    this.csrf = undefined;
    return res;
  }
}
