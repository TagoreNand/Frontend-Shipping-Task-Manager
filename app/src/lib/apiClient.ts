import { newId, shouldSample, toHex, tracer } from './telemetry';
import { formatBaggage } from './baggage';

const SAMPLE_RATE = Number(import.meta.env.VITE_OTLP_SAMPLE_RATE ?? '1');
const DEPLOY_ENV = import.meta.env.VITE_DEPLOY_ENV ?? import.meta.env.MODE;

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Injection point for the access token. */
  getAuthToken?: () => string | undefined;
  /** Invoked when auth fails terminally (after a failed refresh). */
  onAuthError?: () => void;
  /** Single-flight token refresh; returns a new token or null. */
  refreshAuth?: () => Promise<string | null>;
  /** Extra W3C baggage entries (e.g. enduser.role) merged into the request. */
  getBaggage?: () => Record<string, string>;
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  traceId?: string;
  parentSpanId?: string;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, getAuthToken, onAuthError, refreshAuth, getBaggage, timeoutMs = 10_000 } = options;

  async function attempt<T>(path: string, init: RequestOptions, retried: boolean): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (init.signal) {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const token = getAuthToken?.();
    const traceId = init.traceId ?? newId();
    const span = tracer.startSpan('http.request', {
      traceId,
      parentSpanId: init.parentSpanId,
      fields: { method: init.method ?? 'GET', path, retry: retried },
    });
    const sampledFlag = shouldSample(span.traceId, SAMPLE_RATE) ? '01' : '00';
    const traceparent = `00-${toHex(span.traceId, 32)}-${toHex(span.id, 16)}-${sampledFlag}`;
    const tracestate = `shiptivitas=s:${sampledFlag === '01' ? '1' : '0'}`;
    const baggage = formatBaggage({ 'deployment.environment': DEPLOY_ENV, ...(getBaggage?.() ?? {}) });

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': traceId,
          traceparent,
          tracestate,
          ...(baggage ? { baggage } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 && refreshAuth && !retried) {
          const refreshed = await refreshAuth();
          span.event('auth.refresh', { success: refreshed !== null });
          span.end(refreshed ? 'ok' : 'error', { status: 401 });
          if (refreshed) {
            return attempt<T>(path, init, true);
          }
          onAuthError?.();
          throw new ApiError(`Request to ${path} failed`, 401);
        }
        if (response.status === 401) {
          onAuthError?.();
        }
        const errorBody: unknown = await response.json().catch(() => undefined);
        span.end('error', { status: response.status });
        throw new ApiError(`Request to ${path} failed`, response.status, errorBody);
      }

      if (response.status === 204) {
        span.end('ok', { status: 204 });
        return undefined as T;
      }
      const data = (await response.json()) as T;
      span.end('ok', { status: response.status });
      return data;
    } catch (error) {
      if (!(error instanceof ApiError)) {
        span.end('error', { error: String(error) });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { request: (path, init = {}) => attempt(path, init, false) };
}
