import { randomUUID } from 'node:crypto';
import type { Principal, TokenStore } from './tokenStore';
import type { Metrics } from '../metrics/metrics';

export type { Principal } from './tokenStore';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresInMs: number;
}

export interface RefreshResult extends IssuedSession {
  principal: Principal;
}

export type RotateOutcome = ({ status: 'ok' } & RefreshResult) | { status: 'unknown' } | { status: 'reused' };

export interface TokenService {
  isValidAccess(token: string | undefined): Promise<boolean>;
  getPrincipal(token: string | undefined): Promise<Principal | null>;
  issueSession(principal: Principal): Promise<IssuedSession>;
  rotateRefresh(refreshToken: string): Promise<RotateOutcome>;
}

export interface TokenServiceOptions {
  staticToken: string;
  staticPrincipal?: Principal;
  accessTtlMs?: number;
  now?: () => number;
  metrics?: Metrics;
}

const ISSUED = 'shiptivitas_tokens_issued_total';
const REUSE = 'shiptivitas_token_reuse_total';
const REVOKED = 'shiptivitas_families_revoked_total';

export function createTokenService(store: TokenStore, options: TokenServiceOptions): TokenService {
  const {
    staticToken,
    staticPrincipal = { username: 'service', role: 'admin' },
    accessTtlMs = 5 * 60_000,
    now = Date.now,
    metrics,
  } = options;
  const opaque = (): string => randomUUID().replace(/-/g, '');

  if (metrics) {
    metrics.counter(ISSUED, 'Access tokens issued');
    metrics.counter(REUSE, 'Refresh-token reuse events detected');
    metrics.counter(REVOKED, 'Token families revoked on reuse');
  }

  async function principalOf(token: string | undefined): Promise<Principal | null> {
    if (!token) {
      return null;
    }
    if (token === staticToken) {
      return staticPrincipal;
    }
    const record = await store.getAccess(token);
    if (!record || now() > record.expiresAtMs) {
      return null;
    }
    return record.principal;
  }

  async function grant(principal: Principal, familyId: string): Promise<string> {
    const accessToken = opaque();
    await store.putAccess(accessToken, { principal, familyId, expiresAtMs: now() + accessTtlMs }, accessTtlMs);
    metrics?.inc(ISSUED);
    return accessToken;
  }

  return {
    getPrincipal: principalOf,
    async isValidAccess(token) {
      return (await principalOf(token)) !== null;
    },
    async issueSession(principal) {
      const familyId = opaque();
      const refreshToken = opaque();
      await store.putRefresh(refreshToken, { principal, familyId, used: false });
      const accessToken = await grant(principal, familyId);
      return { accessToken, refreshToken, expiresInMs: accessTtlMs };
    },
    async rotateRefresh(refreshToken) {
      const record = await store.getRefresh(refreshToken);
      if (!record) {
        return { status: 'unknown' };
      }
      if (record.used) {
        await store.revokeFamily(record.familyId);
        metrics?.inc(REUSE);
        metrics?.inc(REVOKED);
        return { status: 'reused' };
      }
      await store.putRefresh(refreshToken, { ...record, used: true });
      const nextRefresh = opaque();
      await store.putRefresh(nextRefresh, { principal: record.principal, familyId: record.familyId, used: false });
      const accessToken = await grant(record.principal, record.familyId);
      return { status: 'ok', accessToken, refreshToken: nextRefresh, expiresInMs: accessTtlMs, principal: record.principal };
    },
  };
}
