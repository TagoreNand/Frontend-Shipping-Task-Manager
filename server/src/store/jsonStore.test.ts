import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonTaskStore } from './jsonStore';

const created: string[] = [];
function tmpFile(): string {
  const file = path.join(os.tmpdir(), `tasks-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  created.push(file);
  return file;
}
afterEach(async () => {
  await Promise.all(created.map((file) => fs.rm(file, { force: true })));
});

describe('createJsonTaskStore', () => {
  it('seeds on first use and persists across instances', async () => {
    const file = tmpFile();
    const store = await createJsonTaskStore(file);
    const seeded = await store.read();
    expect(seeded.length).toBeGreaterThan(0);
    const reopened = await createJsonTaskStore(file);
    expect((await reopened.read()).length).toBe(seeded.length);
  });

  it('persists serialized mutations', async () => {
    const store = await createJsonTaskStore(tmpFile());
    const id = (await store.read())[0].id;
    await store.mutate((tasks) => tasks.map((t) => (t.id === id ? { ...t, status: 'complete' } : t)));
    expect((await store.read()).find((t) => t.id === id)?.status).toBe('complete');
  });
});
