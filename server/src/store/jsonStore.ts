import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createSeedTasks } from '../domain/seed';
import type { Task } from '../domain/types';
import type { TaskStore } from './TaskStore';

/** Atomic, mutex-serialized JSON-file store. Seeds itself on first use. */
export async function createJsonTaskStore(filePath: string): Promise<TaskStore> {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Task[]> {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8')) as Task[];
    } catch {
      const seeded = createSeedTasks();
      await save(seeded);
      return seeded;
    }
  }

  async function save(tasks: Task[]): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
  }

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  await enqueue(load);

  return {
    read: () => enqueue(load),
    mutate: (mutator) =>
      enqueue(async () => {
        const next = mutator(await load());
        await save(next);
        return next;
      }),
  };
}
