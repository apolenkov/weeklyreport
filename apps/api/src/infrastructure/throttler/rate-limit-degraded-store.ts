import {
  type ClientRateLimitInfo,
  MemoryStore,
  type Options,
  type Store,
} from "express-rate-limit";

type ReportStoreError = (error: unknown) => void;

function stricterResult(
  local: ClientRateLimitInfo,
  shared: ClientRateLimitInfo,
): ClientRateLimitInfo {
  const resetTimes = [local.resetTime, shared.resetTime].filter(
    (value): value is Date => value !== undefined,
  );
  return {
    totalHits: Math.max(local.totalHits, shared.totalHits),
    resetTime:
      resetTimes.length === 0
        ? undefined
        : new Date(Math.max(...resetTimes.map((value) => value.getTime()))),
  };
}

// Mirrors each hit locally and prefers the stricter count. A Redis outage
// degrades distributed enforcement to per-process enforcement, never bypass.
export class RateLimitDegradedStore implements Store {
  readonly localKeys = false;
  private readonly fallback = new MemoryStore();

  constructor(
    private readonly primary: Store,
    private readonly reportError: ReportStoreError,
  ) {}

  async init(options: Options): Promise<void> {
    this.fallback.init(options);
    try {
      await this.primary.init?.(options);
    } catch (error) {
      this.reportError(error);
    }
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    try {
      const shared = await this.primary.get?.(key);
      return shared ?? (await this.fallback.get(key));
    } catch (error) {
      this.reportError(error);
      return this.fallback.get(key);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const local = await this.fallback.increment(key);
    try {
      const shared = await this.primary.increment(key);
      return stricterResult(local, shared);
    } catch (error) {
      this.reportError(error);
      return local;
    }
  }

  async decrement(key: string): Promise<void> {
    await this.fallback.decrement(key);
    try {
      await this.primary.decrement(key);
    } catch (error) {
      this.reportError(error);
    }
  }

  async resetKey(key: string): Promise<void> {
    await this.fallback.resetKey(key);
    try {
      await this.primary.resetKey(key);
    } catch (error) {
      this.reportError(error);
    }
  }

  async resetAll(): Promise<void> {
    await this.fallback.resetAll();
    try {
      await this.primary.resetAll?.();
    } catch (error) {
      this.reportError(error);
    }
  }

  async shutdown(): Promise<void> {
    this.fallback.shutdown();
    try {
      await this.primary.shutdown?.();
    } catch (error) {
      this.reportError(error);
    }
  }
}
