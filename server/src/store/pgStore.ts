import type { Pool } from 'pg';
import { createSeedTasks } from '../domain/seed';
import type { Task } from '../domain/types';
import type { TaskStore } from './TaskStore';

const SCHEMA = 'CREATE TABLE IF NOT EXISTS tasks (id text PRIMARY KEY, data jsonb NOT NULL)';

/**
 * Postgres-backed TaskStore (tasks stored as jsonb). Schema is ensured and
 * seeded on first use. Mutations run in a transaction, serialized through an
 * in-process queue so a read-modify-write never races within this instance.
 * A drop-in alternative to the JSON-file store behind the same interface.
 */
export async function createPgTaskStore(pool: Pool): Promise<TaskStore> {
  await pool.query(SCHEMA);
  const counted = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM tasks');
  if (counted.rows[0].n === 0) {
    for (const task of createSeedTasks()) {
      await pool.query('INSERT INTO tasks(id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [
        task.id,
        JSON.stringify(task),
      ]);
    }
  }

  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function readAll(): Promise<Task[]> {
    const result = await pool.query<{ data: Task }>('SELECT data FROM tasks');
    return result.rows.map((row) => row.data);
  }

  return {
    read: () => enqueue(readAll),
    mutate: (mutator) =>
      enqueue(async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const current = (await client.query<{ data: Task }>('SELECT data FROM tasks')).rows.map((row) => row.data);
          const next = mutator(current);
          for (const task of next) {
            await client.query(
              'INSERT INTO tasks(id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
              [task.id, JSON.stringify(task)],
            );
          }
          await client.query('COMMIT');
          return next;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }),
  };
}
