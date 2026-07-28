import type { Job, Queue } from "bullmq";

import type {
  AdminJobHandle,
  AdminJobsQueue,
} from "../../modules/admin/index.js";

function toAdminJobHandle(job: Job): AdminJobHandle {
  return {
    ...(job.id === undefined ? {} : { id: job.id }),
    name: job.name,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace ? [...job.stacktrace] : [],
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    data: job.data as unknown,
    retry: () => job.retry(),
    remove: () => job.remove(),
  };
}

export class AdminBullmqJobsQueue implements AdminJobsQueue {
  constructor(private readonly queue: Queue) {}

  async getFailed(
    start: number,
    end: number,
  ): Promise<readonly AdminJobHandle[]> {
    return (await this.queue.getFailed(start, end)).map(toAdminJobHandle);
  }

  async getJob(id: string): Promise<AdminJobHandle | undefined> {
    const job = await this.queue.getJob(id);
    return job ? toAdminJobHandle(job) : undefined;
  }
}
