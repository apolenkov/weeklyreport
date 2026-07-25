/**
 * Capability port for enqueueing one job onto a named queue. A real BullMQ
 * `Queue` satisfies it; an in-memory fake lets services unit-test without Redis.
 */
export interface JobEnqueuer {
  add(
    name: string,
    data: Record<string, unknown>,
    opts?: JobEnqueueOptions,
  ): Promise<unknown>;
}

/** The subset of BullMQ `JobsOptions` the enqueuing services actually set. */
interface JobEnqueueOptions {
  attempts?: number;
  backoff?: { type: string; delay: number };
  // Deterministic job id: BullMQ ignores a second `add` carrying an id already
  // present, so a reaper re-enqueue dedups against a late-arriving original.
  jobId?: string;
}
