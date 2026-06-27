import { describe, expect, it } from 'vitest';
import { createTokenService } from './tokenService';
import { createMemoryTokenStore } from './tokenStore';

const ADMIN = { username: 'a', role: 'admin' };
const make = () => createTokenService(createMemoryTokenStore(), { staticToken: 's' });

describe('createTokenService', () => {
  it('accepts the static token with its principal', async () => {
    const svc = createTokenService(createMemoryTokenStore(), { staticToken: 'static', staticPrincipal: { username: 'svc', role: 'admin' } });
    expect(await svc.isValidAccess('static')).toBe(true);
    expect(await svc.getPrincipal('static')).toEqual({ username: 'svc', role: 'admin' });
    expect(await svc.getPrincipal('nope')).toBeNull();
  });

  it('issues a session whose access token carries the principal', async () => {
    const svc = make();
    const session = await svc.issueSession(ADMIN);
    expect(await svc.getPrincipal(session.accessToken)).toEqual(ADMIN);
  });

  it('rotates a refresh token, issuing a fresh pair', async () => {
    const svc = make();
    const session = await svc.issueSession(ADMIN);
    const rotated = await svc.rotateRefresh(session.refreshToken);
    expect(rotated.status).toBe('ok');
    if (rotated.status === 'ok') {
      expect(rotated.refreshToken).not.toBe(session.refreshToken);
      expect(await svc.getPrincipal(rotated.accessToken)).toEqual(ADMIN);
      expect((await svc.rotateRefresh(rotated.refreshToken)).status).toBe('ok');
    }
  });

  it('detects refresh reuse and revokes the whole family', async () => {
    const svc = make();
    const session = await svc.issueSession(ADMIN);
    const first = await svc.rotateRefresh(session.refreshToken);
    expect((await svc.rotateRefresh(session.refreshToken)).status).toBe('reused');
    if (first.status === 'ok') {
      expect((await svc.rotateRefresh(first.refreshToken)).status).toBe('unknown');
      expect(await svc.isValidAccess(first.accessToken)).toBe(false);
    }
  });

  it('expires access tokens after their TTL', async () => {
    let clock = 1000;
    const svc = createTokenService(createMemoryTokenStore(), { staticToken: 's', accessTtlMs: 100, now: () => clock });
    const session = await svc.issueSession(ADMIN);
    expect(await svc.isValidAccess(session.accessToken)).toBe(true);
    clock += 101;
    expect(await svc.isValidAccess(session.accessToken)).toBe(false);
  });
});
