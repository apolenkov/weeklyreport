/**
 * The single BullMQ capability the enqueuing domain services (reminders,
 * pdf-export) depend on: hand one job onto a named queue. A real BullMQ
 * `Queue` structurally satisfies this port, so the module wiring binds one
 * directly; an in-memory fake lets the services be unit-tested without Redis.
 * Mirrors the RedisReadThroughCache seam — a capability interface over an
 * infrastructure library, consumed by the domain that needs it.
 */
export interface JobEnqueuer {
  add(
    name: string,
    data: Record<string, unknown>,
    opts?: JobEnqueueOptions,
  ): Promise<unknown>;
}

/** The subset of BullMQ `JobsOptions` the enqueuing services actually set. */
export interface JobEnqueueOptions {
  attempts?: number;
  backoff?: { type: string; delay: number };
}
