export interface Principal {
  username: string;
  role: string;
}

export interface AccessRecord {
  principal: Principal;
  familyId: string;
  expiresAtMs: number;
}

export interface RefreshRecord {
  principal: Principal;
  familyId: string;
  used: boolean;
}

/** Persistence boundary for tokens. In-memory + Redis implementations. */
export interface TokenStore {
  getAccess(token: string): Promise<AccessRecord | null>;
  putAccess(token: string, record: AccessRecord, ttlMs: number): Promise<void>;
  getRefresh(token: string): Promise<RefreshRecord | null>;
  putRefresh(token: string, record: RefreshRecord): Promise<void>;
  /** Revoke every access + refresh token in a session family. */
  revokeFamily(familyId: string): Promise<void>;
  /** Active token counts (best-effort). */
  stats(): Promise<{ access: number; refresh: number }>;
  /** Evict expired access tokens; returns how many were removed. */
  sweepExpired(nowMs: number): Promise<number>;
}

export function createMemoryTokenStore(): TokenStore {
  const access = new Map<string, AccessRecord>();
  const refresh = new Map<string, RefreshRecord>();
  return {
    async getAccess(token) {
      return access.get(token) ?? null;
    },
    async putAccess(token, record) {
      access.set(token, record);
    },
    async getRefresh(token) {
      return refresh.get(token) ?? null;
    },
    async putRefresh(token, record) {
      refresh.set(token, record);
    },
    async revokeFamily(familyId) {
      for (const [token, record] of access) {
        if (record.familyId === familyId) {
          access.delete(token);
        }
      }
      for (const [token, record] of refresh) {
        if (record.familyId === familyId) {
          refresh.delete(token);
        }
      }
    },
    async stats() {
      return { access: access.size, refresh: refresh.size };
    },
    async sweepExpired(nowMs) {
      let evicted = 0;
      for (const [token, record] of access) {
        if (record.expiresAtMs < nowMs) {
          access.delete(token);
          evicted += 1;
        }
      }
      return evicted;
    },
  };
}
