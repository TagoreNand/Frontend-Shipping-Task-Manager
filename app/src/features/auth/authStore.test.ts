import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthToken, login, refreshAccessToken, useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'dev-token', refreshToken: 'dev-refresh' });
  });

  it('exposes the token through getAuthToken', () => {
    expect(getAuthToken()).toBe('dev-token');
  });

  it('seeds a refresh token', () => {
    expect(useAuthStore.getState().refreshToken).toBe('dev-refresh');
  });

  it('clearToken clears both tokens', () => {
    useAuthStore.getState().clearToken();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(getAuthToken()).toBeUndefined();
  });

  it('setToken updates the access token', () => {
    useAuthStore.getState().setToken('abc123');
    expect(getAuthToken()).toBe('abc123');
  });

  it('logout clears tokens and user', () => {
    useAuthStore.setState({ token: 'a', refreshToken: 'r', user: 'u' });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('login', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores the session on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ accessToken: 'a', refreshToken: 'r', user: 'dispatcher', role: 'admin' }) })),
    );
    const result = await login('https://api.test', { username: 'dispatcher', password: 'pw' });
    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().user).toBe('dispatcher');
    expect(useAuthStore.getState().role).toBe('admin');
    expect(useAuthStore.getState().token).toBe('a');
  });

  it('returns an error on rejected credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    const result = await login('https://api.test', { username: 'x', password: 'y' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'old', refreshToken: 'dev-refresh' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates the access token on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ accessToken: 'fresh' }) })),
    );
    const token = await refreshAccessToken('https://api.test');
    expect(token).toBe('fresh');
    expect(useAuthStore.getState().token).toBe('fresh');
  });

  it('stores the rotated refresh token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ accessToken: 'fresh', refreshToken: 'rotated' }) })),
    );
    await refreshAccessToken('https://api.test');
    expect(useAuthStore.getState().refreshToken).toBe('rotated');
  });

  it('clears tokens when refresh is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    const token = await refreshAccessToken('https://api.test');
    expect(token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
