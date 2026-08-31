interface ClientQuotaBucket {
  windowStartedAt: number;
  requests: number;
}

export class SentryTunnelQuota {
  private readonly buckets = new Map<string, ClientQuotaBucket>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly maxClients: number,
    private readonly maxKeyLength: number,
  ) {}

  consume(clientKey: string, now = Date.now()): boolean {
    const normalizedKey =
      clientKey.trim().slice(0, this.maxKeyLength) || "anonymous";
    const current = this.buckets.get(normalizedKey);

    if (current && now - current.windowStartedAt < this.windowMs) {
      if (current.requests >= this.maxRequests) return false;
      current.requests += 1;
      return true;
    }

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStartedAt >= this.windowMs) {
        this.buckets.delete(key);
      }
    }

    if (!current && this.buckets.size >= this.maxClients) return false;
    this.buckets.set(normalizedKey, { windowStartedAt: now, requests: 1 });
    return true;
  }
}
