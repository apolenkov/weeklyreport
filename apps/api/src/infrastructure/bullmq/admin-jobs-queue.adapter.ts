import { failedJobSchema } from "@customreport/shared";
import type { Job, Queue } from "bullmq";

import type {
  AdminJobHandle,
  AdminJobsQueue,
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

export function createAdminJobHandle(job: AdminQueueJob): AdminJobHandle {
  return {
    failedJob: failedJobSchema.parse({
      id: job.id,
      name: job.name,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }),
    reminderExecutionId: getReminderExecutionId(job.data),
    retry: () => job.retry(),
    remove: () => job.remove(),
  };
}

export class AdminBullmqJobsQueue implements AdminJobsQueue {
  constructor(private readonly queue: Queue) {}

  readonly getFailed = async (
    start: number,
    end: number,
  ): Promise<readonly AdminJobHandle[]> => {
    return (await this.queue.getFailed(start, end)).map(createAdminJobHandle);
  };

  readonly getJob = async (id: string): Promise<AdminJobHandle | undefined> => {
    const job = await this.queue.getJob(id);
    return job ? createAdminJobHandle(job) : undefined;
  };
}
