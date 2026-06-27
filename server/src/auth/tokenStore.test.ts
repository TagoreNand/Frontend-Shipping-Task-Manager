import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { createMemoryTokenStore } from './tokenStore';
import { createRedisTokenStore } from './redisTokenStore';
import type { TokenStore } from './tokenStore';

const PRINCIPAL = { username: 'u', role: 'admin' };

async function suite(store: TokenStore): Promise<void> {
  await store.putAccess('a1', { principal: PRINCIPAL, familyId: 'f1', expiresAtMs: Date.now() + 60_000 }, 60_000);
  await store.putRefresh('r1', { principal: PRINCIPAL, familyId: 'f1', used: false });
  expect(await store.getAccess('a1')).toMatchObject({ familyId: 'f1' });
  expect(await store.getRefresh('r1')).toMatchObject({ used: false });
  expect(await store.stats()).toMatchObject({ access: 1, refresh: 1 });
  await store.revokeFamily('f1');
  expect(await store.getAccess('a1')).toBeNull();
  expect(await store.getRefresh('r1')).toBeNull();
}

describe('memory token store eviction', () => {
  it('sweeps expired access tokens', async () => {
    const store = createMemoryTokenStore();
    await store.putAccess('a', { principal: PRINCIPAL, familyId: 'f', expiresAtMs: 50 }, 50);
    expect((await store.stats()).access).toBe(1);
    expect(await store.sweepExpired(100)).toBe(1);
    expect((await store.stats()).access).toBe(0);
  });
});

describe('token stores', () => {
  it('in-memory store round-trips and revokes families', async () => {
    await suite(createMemoryTokenStore());
  });
  it('redis store (ioredis-mock) round-trips and revokes families', async () => {
    await suite(createRedisTokenStore(new RedisMock() as unknown as Redis));
  });
});
