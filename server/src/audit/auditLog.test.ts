import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { createMemoryAuditLog, createPgAuditLog } from './auditLog';
import type { AuditLog } from './auditLog';

function makePool(): Pool {
  const pg = newDb().adapters.createPg();
  return new pg.Pool() as unknown as Pool;
}

async function suite(audit: AuditLog): Promise<void> {
  await audit.record({ actor: 'admin', action: 'user.create', target: 'ops', detail: 'role=dispatcher' });
  await audit.record({ actor: 'admin', action: 'user.delete', target: 'ops' });
  const entries = await audit.list();
  expect(entries).toHaveLength(2);
  expect(entries[0].action).toBe('user.delete'); // newest first
  expect(entries[1]).toMatchObject({ actor: 'admin', action: 'user.create', target: 'ops' });
  const filtered = await audit.list({ action: 'user.create' });
  expect(filtered).toHaveLength(1);
  expect(filtered[0].action).toBe('user.create');
}

describe('audit log', () => {
  it('in-memory records and lists newest-first', async () => {
    await suite(createMemoryAuditLog());
  });
  it('postgres records and lists newest-first', async () => {
    await suite(await createPgAuditLog(makePool()));
  });
});
