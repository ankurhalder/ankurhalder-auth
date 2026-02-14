/**
 * Simple LRU cache with TTL support.
 *
 * Used as a per-process fallback when Redis is unavailable.
 * NOT shared across serverless instances — each instance has its own cache.
 *
 * Design:
 * - Fixed maximum capacity (evicts oldest on overflow)
 * - Entries auto-expire based on TTL
 * - O(1) get/set via Map (Map preserves insertion order in JS)
 */
export class SimpleLRU<V> {
  private readonly cache = new Map<string, { value: V; expiresAt: number }>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Set a value with a TTL (in seconds).
   */
  set(key: string, value: V, ttlSeconds: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.delete(key);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get a value. Returns undefined if not found or expired.
   */
  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Current number of entries (including potentially expired ones).
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries. Called periodically or on demand.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}
