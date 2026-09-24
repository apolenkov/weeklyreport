import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJob,
  PDF_EXPORT_QUEUE_NAME,
  type QueueName,
} from "@customreport/shared";

/** Non-credential identity a pdf-export queue payload claims; the durable export row decides whether it is true. */
export interface AdminPdfExportIdentity {
  readonly jobId: string;
  readonly reportId: string;
  readonly requestedBy: string;
}

/** Queue-side operations the coordinated pdf-export retry drives while it holds the export row lock. */
export interface AdminPdfExportRetryQueue {
  readonly isFailed: () => Promise<boolean>;
  readonly retry: () => Promise<void>;
}

export type AdminPdfExportRetryOutcome =
  "retried" | "queue-not-failed" | "ineligible";

export type AdminJobDomainReference =
  | {
      readonly queue: typeof EMAIL_REMINDER_QUEUE_NAME;
      readonly reminderExecutionId: string | null;
    }
  | {
      readonly queue: typeof PDF_EXPORT_QUEUE_NAME;
      readonly pdfExportIdentity: AdminPdfExportIdentity | null;
    }
  | {
      readonly queue: Exclude<
        QueueName,
        typeof EMAIL_REMINDER_QUEUE_NAME | typeof PDF_EXPORT_QUEUE_NAME
      >;
    };

export interface AdminJobHandle {
  readonly failedJob: FailedJob;
  readonly domainReference: AdminJobDomainReference;
  // Live queue state. Coordinated retries re-read it after the durable row
  // lock is held; a state captured beforehand is already stale.
  readonly getState: () => Promise<string>;
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
