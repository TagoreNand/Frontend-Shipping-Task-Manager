import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUser, deleteUser, listUsers } from './usersApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usersApi', () => {
  it('lists users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: '1', username: 'a', role: 'admin', displayName: 'A' }] })),
    );
    const users = await listUsers();
    expect(users[0].username).toBe('a');
  });

  it('creates a user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: '2', username: 'b', role: 'dispatcher', displayName: 'b' }) })),
    );
    const user = await createUser({ username: 'b', password: 'pw', role: 'dispatcher' });
    expect(user.id).toBe('2');
  });

  it('deletes a user via a 204 response', async () => {
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
    await expect(deleteUser('2')).resolves.toBeUndefined();
  });
});
