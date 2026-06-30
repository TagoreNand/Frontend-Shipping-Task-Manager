import { create } from 'zustand';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const DEV_TOKEN = import.meta.env.VITE_DEV_TOKEN ?? 'dev-token';
const DEV_REFRESH_TOKEN = import.meta.env.VITE_DEV_REFRESH_TOKEN ?? 'dev-refresh';

/** Real auth (login screen) is required only when talking to the backend. */
export const requiresAuth = !USE_MOCK;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: string;
  role: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: string | null;
  role: string | null;
  setSession: (session: Session) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  clearToken: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: USE_MOCK ? DEV_TOKEN : null,
  refreshToken: USE_MOCK ? DEV_REFRESH_TOKEN : null,
  user: USE_MOCK ? 'demo' : null,
  role: USE_MOCK ? 'dispatcher' : null,
  setSession: ({ accessToken, refreshToken, user, role }) => set({ token: accessToken, refreshToken, user, role }),
  setToken: (token) => set({ token }),
  setRefreshToken: (refreshToken) => set({ refreshToken }),
  clearToken: () => set({ token: null, refreshToken: null }),
  logout: () => set({ token: null, refreshToken: null, user: null, role: null }),
}));

export function getAuthToken(): string | undefined {
  return useAuthStore.getState().token ?? undefined;
}

/** Dynamic W3C baggage for outbound requests (the signed-in user's role). */
export function appBaggage(): Record<string, string> {
  const role = useAuthStore.getState().role;
  return role ? { 'enduser.role': role } : {};
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function login(baseUrl: string, credentials: { username: string; password: string }): Promise<LoginResult> {
  try {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      return { ok: false, error: response.status === 401 ? 'Invalid username or password.' : 'Login failed.' };
    }
    useAuthStore.getState().setSession((await response.json()) as Session);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — is the server running?' };
  }
}

/** Self-service signup (creates a customer account and logs in). */
export async function signup(
  baseUrl: string,
  credentials: { username: string; password: string; displayName?: string },
): Promise<LoginResult> {
  try {
    const response = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      return { ok: false, error: response.status === 409 ? 'That username is taken.' : 'Sign-up failed (password needs 6+ chars).' };
    }
    useAuthStore.getState().setSession((await response.json()) as Session);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — is the server running?' };
  }
}

let inflightRefresh: Promise<string | null> | null = null;

/** Single-flight access-token refresh; stores the rotated refresh token too. */
export function refreshAccessToken(baseUrl: string): Promise<string | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }
  inflightRefresh = doRefresh(baseUrl).finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function doRefresh(baseUrl: string): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    useAuthStore.getState().clearToken();
    return null;
  }
  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      useAuthStore.getState().clearToken();
      return null;
    }
    const data = (await response.json()) as { accessToken: string; refreshToken?: string };
    const state = useAuthStore.getState();
    state.setToken(data.accessToken);
    if (data.refreshToken) {
      state.setRefreshToken(data.refreshToken);
    }
    return data.accessToken;
  } catch {
    return null;
  }
}
