export interface JobEnqueuer {
  readonly add: (
    name: string,
    data: Readonly<Record<string, unknown>>,
    opts?: JobEnqueueOptions,
  ) => Promise<unknown>;
  /** Read and remove an existing BullMQ job when a recovery must replace it. */
  readonly getJob?: (jobId: string) => Promise<
    | {
        readonly getState: () => Promise<string>;
        readonly remove: () => Promise<void>;
      }
    | undefined
  >;
}

interface JobEnqueueOptions {
  readonly attempts?: number;
  readonly backoff?: { readonly type: string; readonly delay: number };
  // Stable job id for normal dispatch. Recovery may first remove a terminal
  // job with this id, because BullMQ otherwise silently ignores the add.
  readonly jobId?: string;
}
