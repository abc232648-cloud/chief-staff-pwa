import { isChiefStaffDevMode } from '../config/devMode';
import { ChiefApiError, type ApiResponse } from './types';

let csrfProvider: (() => string | null) | null = null;

export function setStaffApiCsrfProvider(provider: (() => string | null) | null): void {
  csrfProvider = provider;
}

interface RequestOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function safeApiPath(path: string): boolean {
  return path.startsWith('/api/') && !path.startsWith('//') && !path.includes('://');
}

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (!text) return {};
    throw new ChiefApiError({
      message: 'Chief returned an unexpected non-JSON API response.',
      origin: 'protocol',
      code: 'UNEXPECTED_CONTENT_TYPE',
      status: response.status,
      correlationId: response.headers.get('X-Correlation-ID')
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new ChiefApiError({
      message: 'Chief returned malformed JSON.',
      origin: 'protocol',
      code: 'MALFORMED_JSON',
      status: response.status,
      correlationId: response.headers.get('X-Correlation-ID'),
      details: cause
    });
  }
}

export async function chiefRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  if (!safeApiPath(path)) {
    throw new ChiefApiError({
      message: 'Only same-origin Chief API paths are permitted.',
      origin: 'client',
      code: 'UNSAFE_API_PATH'
    });
  }

  if (isChiefStaffDevMode()) {
    throw new ChiefApiError({
      message: 'Development fixtures cannot call the live Chief API.',
      origin: 'client',
      code: 'DEV_LIVE_API_BLOCKED'
    });
  }

  const method = options.method ?? 'GET';
  const mutation = !['GET', 'HEAD'].includes(method);
  const csrf = mutation ? csrfProvider?.() ?? null : null;
  if (mutation && !csrf) {
    throw new ChiefApiError({
      message: 'A live Chief CSRF token is required for this mutation.',
      origin: 'client',
      code: 'CSRF_REQUIRED'
    });
  }

  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrf) headers.set('X-Chief-CSRF', csrf);

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 8000;
  let timeoutTriggered = false;
  const timeoutId = window.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const correlationId = response.headers.get('X-Correlation-ID');
    const payload = await parsePayload(response);

    if (!response.ok) {
      const body = payload as { reason?: string; message?: string; status?: string; code?: string };
      throw new ChiefApiError({
        message: body.reason || body.message || `Chief API request failed (${response.status}).`,
        origin: 'chief',
        code: body.code || body.status || `HTTP_${response.status}`,
        status: response.status,
        correlationId,
        details: payload
      });
    }

    return {
      data: payload as T,
      status: response.status,
      correlationId,
      fetchedAt: Date.now(),
      provenance: 'live'
    };
  } catch (cause) {
    if (cause instanceof ChiefApiError) throw cause;

    if (controller.signal.aborted) {
      throw new ChiefApiError({
        message: timeoutTriggered ? `Chief request timed out after ${timeoutMs}ms.` : 'Chief request was cancelled.',
        origin: 'transport',
        code: timeoutTriggered ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED',
        details: cause
      });
    }

    throw new ChiefApiError({
      message: 'Chief backend is unreachable from this device.',
      origin: 'transport',
      code: 'NETWORK_UNAVAILABLE',
      details: cause
    });
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const chiefApiClient = {
  get<T>(path: string, signal?: AbortSignal) {
    return chiefRequest<T>(path, { method: 'GET', signal });
  },
  post<T>(path: string, body: unknown, signal?: AbortSignal) {
    return chiefRequest<T>(path, { method: 'POST', body, signal });
  },
  put<T>(path: string, body: unknown, signal?: AbortSignal) {
    return chiefRequest<T>(path, { method: 'PUT', body, signal });
  },
  delete<T>(path: string, signal?: AbortSignal) {
    return chiefRequest<T>(path, { method: 'DELETE', signal });
  }
};
