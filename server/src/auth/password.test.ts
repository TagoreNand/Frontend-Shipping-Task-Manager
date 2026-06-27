import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret');
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(await verifyPassword('s3cret', hash)).toBe(true);
    expect(await verifyPassword('nope', hash)).toBe(false);
  });

  it('produces a unique salt per hash', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});
