import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJob,
  type QueueName,
} from "@customreport/shared";

export type AdminJobDomainReference =
  | {
      readonly queue: typeof EMAIL_REMINDER_QUEUE_NAME;
      readonly reminderExecutionId: string | null;
    }
  | {
      readonly queue: Exclude<QueueName, typeof EMAIL_REMINDER_QUEUE_NAME>;
    };

export interface AdminJobHandle {
  readonly failedJob: FailedJob;
  readonly domainReference: AdminJobDomainReference;
  readonly retry: () => Promise<void>;
  readonly remove: () => Promise<void>;
}

export interface AdminJobsQueue {
  readonly getFailedCount: () => Promise<number>;
  readonly getFailed: (
    start: number,
    end: number,
  ) => Promise<readonly AdminJobHandle[]>;
  readonly getJob: (id: string) => Promise<AdminJobHandle | undefined>;
}

export interface AdminJobsQueueRegistry {
  readonly get: (name: QueueName) => AdminJobsQueue;
  readonly names: readonly QueueName[];
}
