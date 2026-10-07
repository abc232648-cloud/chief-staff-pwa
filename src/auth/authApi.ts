export interface BackendPrincipal {
  id: string;
  session_id: string;
  role: string;
  domains: string[];
  reauth_at: string;
}

export interface AuthSessionResponse {
  principal: BackendPrincipal;
  csrf: string;
  instance_mode: string;
}

export interface FarmSetupOverview {
  farm_role: 'OWNER' | 'GENERAL_MANAGER' | 'SUPERVISOR' | 'WORKER';
  can_manage: boolean;
  can_setup: boolean;
  can_assign: boolean;
  can_finance?: boolean;
}

export class AuthApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; csrf?: string } = {}
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.csrf) headers.set('X-Chief-CSRF', options.csrf);

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const body = payload as { reason?: string; message?: string; status?: string };
    throw new AuthApiError(
      body.reason || body.message || `Chief authentication request failed (${response.status}).`,
      response.status,
      body.status
    );
  }

  return payload as T;
}

export const authApi = {
  login(username: string, password: string) {
    return requestJson<{ status: 'SIGNED_IN'; csrf: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });
  },
  session() {
    return requestJson<AuthSessionResponse>('/api/auth/session');
  },
  farmSetup() {
    return requestJson<FarmSetupOverview>('/api/farm/setup');
  },
  activity(csrf: string) {
    return requestJson<{ status: 'ACTIVITY_RECORDED' }>('/api/auth/activity', {
      method: 'POST',
      body: {},
      csrf
    });
  },
  reauthenticate(password: string, csrf: string) {
    return requestJson<{ status: 'REAUTHENTICATED'; csrf: string }>('/api/auth/reauthenticate', {
      method: 'POST',
      body: { password },
      csrf
    });
  },
  logout(csrf: string) {
    return requestJson<{ status: 'SIGNED_OUT' }>('/api/auth/logout', {
      method: 'POST',
      body: {},
      csrf
    });
  }
};
