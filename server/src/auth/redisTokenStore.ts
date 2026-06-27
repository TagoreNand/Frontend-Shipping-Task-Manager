import type { Redis } from 'ioredis';
import type { AccessRecord, RefreshRecord, TokenStore } from './tokenStore';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Redis-backed token store — sessions survive process restarts. */
export function createRedisTokenStore(redis: Redis): TokenStore {
  const accessKey = (token: string): string => `tok:access:${token}`;
  const refreshKey = (token: string): string => `tok:refresh:${token}`;
  const familyKey = (familyId: string): string => `tok:family:${familyId}`;

  return {
    async getAccess(token) {
      const raw = await redis.get(accessKey(token));
      return raw ? (JSON.parse(raw) as AccessRecord) : null;
    },
    async putAccess(token, record, ttlMs) {
      await redis.set(accessKey(token), JSON.stringify(record), 'PX', Math.max(1, Math.round(ttlMs)));
      await redis.sadd(familyKey(record.familyId), `a:${token}`);
    },
    async getRefresh(token) {
      const raw = await redis.get(refreshKey(token));
      return raw ? (JSON.parse(raw) as RefreshRecord) : null;
    },
    async putRefresh(token, record) {
      await redis.set(refreshKey(token), JSON.stringify(record), 'EX', REFRESH_TTL_SECONDS);
      await redis.sadd(familyKey(record.familyId), `r:${token}`);
    },
    async revokeFamily(familyId) {
      const members = await redis.smembers(familyKey(familyId));
      const keys = members.map((m) => (m.startsWith('a:') ? accessKey(m.slice(2)) : refreshKey(m.slice(2))));
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(familyKey(familyId));
    },
    async stats() {
      const count = async (pattern: string): Promise<number> => {
        let cursor = '0';
        let total = 0;
        do {
          const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
          cursor = next;
          total += keys.length;
        } while (cursor !== '0');
        return total;
      };
      return { access: await count('tok:access:*'), refresh: await count('tok:refresh:*') };
    },
    async sweepExpired() {
      // Redis evicts expired keys via TTL; nothing to sweep.
      return 0;
    },
  };
}
