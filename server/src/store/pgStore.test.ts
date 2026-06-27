import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { createPgTaskStore } from './pgStore';

function makePool(): Pool {
  const pg = newDb().adapters.createPg();
  return new pg.Pool() as unknown as Pool;
}

describe('createPgTaskStore', () => {
  it('seeds and reads tasks', async () => {
    const store = await createPgTaskStore(makePool());
    expect((await store.read()).length).toBeGreaterThan(0);
  });

  it('persists a transactional mutation', async () => {
    const store = await createPgTaskStore(makePool());
    const id = (await store.read())[0].id;
    await store.mutate((tasks) => tasks.map((t) => (t.id === id ? { ...t, status: 'complete' } : t)));
    expect((await store.read()).find((t) => t.id === id)?.status).toBe('complete');
  });
});
