export interface JobEnqueuer {
  readonly add: (
    name: string,
    data: Readonly<Record<string, unknown>>,
    opts?: JobEnqueueOptions,
  ) => Promise<unknown>;
}

interface JobEnqueueOptions {
  readonly attempts?: number;
  readonly backoff?: { readonly type: string; readonly delay: number };
  // Deterministic job id: BullMQ ignores a second `add` carrying an id already
  // present, so a reaper re-enqueue dedups against a late-arriving original.
  readonly jobId?: string;
}
