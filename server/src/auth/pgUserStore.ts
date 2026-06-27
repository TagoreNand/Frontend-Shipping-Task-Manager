import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { hashPassword, verifyPassword } from './password';
import type { SeedUser, User, UserStore } from './userStore';

const SCHEMA = `CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  display_name text NOT NULL
)`;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  display_name: string;
}
const toUser = (row: UserRow): User => ({ id: row.id, username: row.username, role: row.role, displayName: row.display_name });

export async function createPgUserStore(pool: Pool, seed: SeedUser[] = []): Promise<UserStore> {
  await pool.query(SCHEMA);
  const counted = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
  if (counted.rows[0].n === 0) {
    for (const entry of seed) {
      await pool.query(
        'INSERT INTO users(id, username, password_hash, role, display_name) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), entry.username, await hashPassword(entry.password), entry.role ?? 'dispatcher', entry.displayName ?? entry.username],
      );
    }
  }

  return {
    async verify(username, password) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
      const row = result.rows[0];
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return null;
      }
      return toUser(row);
    },
    async list() {
      const result = await pool.query<UserRow>('SELECT * FROM users ORDER BY username');
      return result.rows.map(toUser);
    },
    async create(input) {
      const id = randomUUID();
      await pool.query('INSERT INTO users(id, username, password_hash, role, display_name) VALUES ($1,$2,$3,$4,$5)', [
        id,
        input.username,
        await hashPassword(input.password),
        input.role ?? 'dispatcher',
        input.displayName ?? input.username,
      ]);
      return { id, username: input.username, role: input.role ?? 'dispatcher', displayName: input.displayName ?? input.username };
    },
    async updateRole(id, role) {
      const result = await pool.query<UserRow>('UPDATE users SET role = $2 WHERE id = $1 RETURNING *', [id, role]);
      const row = result.rows[0];
      return row ? toUser(row) : null;
    },
    async remove(id) {
      const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    },
    async changePassword(username, currentPassword, newPassword) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
      const row = result.rows[0];
      if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
        return false;
      }
      await pool.query('UPDATE users SET password_hash = $2 WHERE username = $1', [username, await hashPassword(newPassword)]);
      return true;
    },
  };
}
