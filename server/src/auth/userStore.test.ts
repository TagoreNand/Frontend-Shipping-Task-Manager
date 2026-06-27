import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { createInMemoryUserStore } from './userStore';
import { createPgUserStore } from './pgUserStore';
import type { UserStore } from './userStore';

const SEED = [{ username: 'dispatcher', password: 'pw', role: 'dispatcher', displayName: 'Demo' }];

function makePool(): Pool {
  const pg = newDb().adapters.createPg();
  return new pg.Pool() as unknown as Pool;
}

async function crudSuite(store: UserStore): Promise<void> {
  expect(await store.verify('dispatcher', 'pw')).toMatchObject({ username: 'dispatcher', role: 'dispatcher' });
  expect(await store.verify('dispatcher', 'bad')).toBeNull();

  const created = await store.create({ username: 'ops', password: 'pw2', role: 'dispatcher' });
  expect((await store.list()).some((u) => u.username === 'ops')).toBe(true);

  const updated = await store.updateRole(created.id, 'admin');
  expect(updated?.role).toBe('admin');
  expect(await store.verify('ops', 'pw2')).toMatchObject({ role: 'admin' });

  expect(await store.remove(created.id)).toBe(true);
  expect(await store.remove('missing')).toBe(false);
}

describe('in-memory user store', () => {
  it('supports verify + CRUD', async () => {
    await crudSuite(await createInMemoryUserStore(SEED));
  });
  it('rejects duplicate usernames', async () => {
    const store = await createInMemoryUserStore(SEED);
    await expect(store.create({ username: 'dispatcher', password: 'x' })).rejects.toThrow();
  });
});

describe('postgres user store', () => {
  it('supports verify + CRUD', async () => {
    await crudSuite(await createPgUserStore(makePool(), SEED));
  });
});
