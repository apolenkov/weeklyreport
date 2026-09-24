import {
  EMAIL_REMINDER_QUEUE_NAME,
  failedJobSchema,
  PDF_EXPORT_QUEUE_NAME,
  type QueueName,
} from "@customreport/shared";
import type { Job, Queue } from "bullmq";

import type {
  AdminJobHandle,
  AdminJobsQueue,
  AdminPdfExportIdentity,
} from "../../modules/admin/index.js";

type AdminQueueJob = Pick<
  Job,
  | "id"
  | "name"
  | "failedReason"
  | "stacktrace"
  | "attemptsMade"
  | "timestamp"
  | "data"
  | "retry"
  | "remove"
  | "getState"
>;

// Reads the reminder-execution id out of the raw job payload; the port needs
// it to prune stale jobs whose execution row was already deleted.
function getReminderExecutionId(data: unknown): string | null {
  if (
    data &&
    typeof data === "object" &&
    "executionId" in data &&
    typeof data.executionId === "string" &&
    data.executionId.trim().length > 0
  ) {
    return data.executionId;
  }

  return null;
}

// Reads the non-credential identity a pdf-export job payload claims. A
// missing or malformed triple fails closed: the coordinated retry cannot
// bind the queue job to a durable export row without all three fields.
function getPdfExportIdentity(data: unknown): AdminPdfExportIdentity | null {
  if (data === null || typeof data !== "object") return null;
  const payload = data as {
    jobId?: unknown;
    reportId?: unknown;
    requestedBy?: unknown;
  };
  if (typeof payload.jobId !== "string" || payload.jobId.length === 0) {
    return null;
  }
  if (typeof payload.reportId !== "string" || payload.reportId.length === 0) {
    return null;
  }
  if (
    typeof payload.requestedBy !== "string" ||
    payload.requestedBy.length === 0
  ) {
    return null;
  }
  return {
    jobId: payload.jobId,
    reportId: payload.reportId,
    requestedBy: payload.requestedBy,
  };
}

export function createAdminJobHandle(
  queue: QueueName,
  job: AdminQueueJob,
): AdminJobHandle {
  return {
    failedJob: failedJobSchema.parse({
      id: job.id,
      name: job.name,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }),
    domainReference:
      queue === EMAIL_REMINDER_QUEUE_NAME
        ? {
            queue,
            reminderExecutionId: getReminderExecutionId(job.data),
          }
        : queue === PDF_EXPORT_QUEUE_NAME
          ? {
              queue,
              pdfExportIdentity: getPdfExportIdentity(job.data),
            }
          : { queue },
    getState: () => job.getState(),
    retry: () => job.retry(),
    remove: () => job.remove(),
  };
}

export class AdminBullmqJobsQueue implements AdminJobsQueue {
  constructor(
    private readonly name: QueueName,
    private readonly queue: Queue,
  ) {}

  readonly getFailed = async (
    start: number,
    end: number,
  ): Promise<readonly AdminJobHandle[]> => {
    return (await this.queue.getFailed(start, end)).map((job) =>
      createAdminJobHandle(this.name, job),
    );
  };

  readonly getFailedCount = (): Promise<number> => this.queue.getFailedCount();

  readonly getJob = async (id: string): Promise<AdminJobHandle | undefined> => {
    const job = await this.queue.getJob(id);
    return job ? createAdminJobHandle(this.name, job) : undefined;
  };
}
