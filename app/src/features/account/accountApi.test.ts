import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from './accountApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accountApi', () => {
  it('resolves on a 204 password change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('no body');
        },
      })),
    );
    await expect(changePassword('old', 'newpass1')).resolves.toBeUndefined();
  });

  it('rejects when the current password is wrong (400)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'nope' }) })));
    await expect(changePassword('bad', 'newpass1')).rejects.toBeTruthy();
  });
});
