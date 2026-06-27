import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

export interface RecordInput {
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

export interface ListOptions {
  actor?: string;
  action?: string;
  limit?: number;
}

export interface AuditLog {
  record(input: RecordInput): Promise<void>;
  list(options?: ListOptions): Promise<AuditEntry[]>;
}

export function createMemoryAuditLog(max = 500): AuditLog {
  const entries: AuditEntry[] = [];
  return {
    async record(input) {
      entries.push({ id: randomUUID(), at: new Date().toISOString(), ...input });
      if (entries.length > max) {
        entries.splice(0, entries.length - max);
      }
    },
    async list(options = {}) {
      const { actor, action, limit = 100 } = options;
      let result = entries.slice().reverse();
      if (actor) {
        result = result.filter((entry) => entry.actor === actor);
      }
      if (action) {
        result = result.filter((entry) => entry.action === action);
      }
      return result.slice(0, limit);
    },
  };
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  at text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  target text,
  detail text
)`;

interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
}

export async function createPgAuditLog(pool: Pool): Promise<AuditLog> {
  await pool.query(SCHEMA);
  return {
    async record(input) {
      await pool.query('INSERT INTO audit_log(id, at, actor, action, target, detail) VALUES ($1,$2,$3,$4,$5,$6)', [
        randomUUID(),
        new Date().toISOString(),
        input.actor,
        input.action,
        input.target ?? null,
        input.detail ?? null,
      ]);
    },
    async list(options = {}) {
      const { actor, action, limit = 100 } = options;
      const where: string[] = [];
      const params: unknown[] = [];
      if (actor) {
        params.push(actor);
        where.push(`actor = $${params.length}`);
      }
      if (action) {
        params.push(action);
        where.push(`action = $${params.length}`);
      }
      params.push(limit);
      const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const sql = `SELECT id, at, actor, action, target, detail FROM audit_log ${clause} ORDER BY at DESC LIMIT $${params.length}`;
      const result = await pool.query<AuditRow>(sql, params);
      return result.rows.map((row) => ({
        id: row.id,
        at: row.at,
        actor: row.actor,
        action: row.action,
        target: row.target ?? undefined,
        detail: row.detail ?? undefined,
      }));
    },
  };
}
