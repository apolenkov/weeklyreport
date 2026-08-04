import type { FailedJob } from "@customreport/shared";

export interface AdminJobHandle {
  readonly failedJob: FailedJob;
  readonly reminderExecutionId: string | null;
  readonly retry: () => Promise<void>;
  readonly remove: () => Promise<void>;
}

export interface AdminJobsQueue {
  readonly getFailed: (
    start: number,
    end: number,
  ) => Promise<readonly AdminJobHandle[]>;
  readonly getJob: (id: string) => Promise<AdminJobHandle | undefined>;
}
