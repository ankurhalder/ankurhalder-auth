import type { IRevocationStore } from "@app/interfaces/revocation.store";
import { getRedisClient, recordRedisFailure } from "./client";
import { SimpleLRU } from "./simple-lru";

const KEYS = {
  token: (jti: string) => `revoked:token:${jti}`,
  session: (sessionId: string) => `revoked:session:${sessionId}`,
  user: (userId: string) => `revoked:user:${userId}`,
} as const;

const LRU_MAX_SIZE = 10_000;

export class RevocationStoreImpl implements IRevocationStore {
  private readonly tokenLRU = new SimpleLRU<true>(LRU_MAX_SIZE);
  private readonly sessionLRU = new SimpleLRU<true>(LRU_MAX_SIZE);
  private readonly userLRU = new SimpleLRU<number>(LRU_MAX_SIZE);

  async revokeToken(jti: string, ttlSeconds: number): Promise<void> {
    this.tokenLRU.set(jti, true, ttlSeconds);

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(KEYS.token(jti), "1", { ex: ttlSeconds });
      } catch (error) {
        recordRedisFailure(error);
      }
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    if (this.tokenLRU.has(jti)) {
      return true;
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        const result = await redis.get(KEYS.token(jti));
        if (result !== null) {
          this.tokenLRU.set(jti, true, 900);
          return true;
        }
      } catch (error) {
        recordRedisFailure(error);
      }
    }

    return false;
  }

  async revokeSession(sessionId: string, ttlSeconds: number): Promise<void> {
    this.sessionLRU.set(sessionId, true, ttlSeconds);

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(KEYS.session(sessionId), "1", { ex: ttlSeconds });
      } catch (error) {
        recordRedisFailure(error);
      }
    }
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    if (this.sessionLRU.has(sessionId)) {
      return true;
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        const result = await redis.get(KEYS.session(sessionId));
        if (result !== null) {
          this.sessionLRU.set(sessionId, true, 604_800);
          return true;
        }
      } catch (error) {
        recordRedisFailure(error);
      }
    }

    return false;
  }

  async revokeAllUserSessions(
    userId: string,
    ttlSeconds: number
  ): Promise<void> {
    const timestamp = Date.now();

    this.userLRU.set(userId, timestamp, ttlSeconds);

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(KEYS.user(userId), timestamp.toString(), {
          ex: ttlSeconds,
        });
      } catch (error) {
        recordRedisFailure(error);
      }
    }
  }

  async getUserRevocationTimestamp(userId: string): Promise<number | null> {
    const lruTimestamp = this.userLRU.get(userId);
    if (lruTimestamp !== undefined) {
      return lruTimestamp;
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        const result = await redis.get<string>(KEYS.user(userId));
        if (result !== null) {
          const timestamp = parseInt(result, 10);
          if (!isNaN(timestamp)) {
            this.userLRU.set(userId, timestamp, 2_592_000);
            return timestamp;
          }
        }
      } catch (error) {
        recordRedisFailure(error);
      }
    }

    return null;
  }
}
