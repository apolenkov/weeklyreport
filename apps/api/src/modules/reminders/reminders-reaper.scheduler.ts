import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersService } from "./reminders.service";

// Reclaims ONLY `queued` rows; a `sending` row is an in-flight send whose
// re-enqueue could duplicate. Re-enqueue is safe against a late original: the
// deterministic jobId dedups at the queue and the CAS send guard sends once.
@Injectable()
export class RemindersReaperScheduler {
  private readonly logger = new Logger(RemindersReaperScheduler.name);

  // A row committed `queued` whose enqueue never happened has no job, no
  // `failed` marker and a pinned dedupeKey, so nothing else retries it. This
  // age is well past the seconds-scale insert→enqueue window.
  private readonly stuckQueuedTimeoutMs = 900_000;

  // Past this conservative bound, a `sending` row has an unknowable SMTP
  // outcome. It becomes terminal and observable; automation never resends it.
  private readonly stuckSendingTimeoutMs = 1_800_000;

  constructor(
    @Inject(RemindersService) private readonly service: RemindersService,
    @Inject(RemindersPrismaRepository)
    private readonly repository: RemindersPrismaRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reapStuckQueued(): Promise<void> {
    await this.runOnce(new Date());
  }

  async runOnce(now: Date): Promise<void> {
    const olderThan = new Date(now.getTime() - this.stuckQueuedTimeoutMs);
    const stuck = await this.repository.listStuckQueuedExecutions(olderThan);
    for (const execution of stuck) {
      // Per-execution isolation: one re-enqueue failure never aborts the rest.
      try {
        await this.service.reEnqueueStuckExecution(execution);
      } catch (error: unknown) {
        this.logger.error("reaper failed to re-enqueue stuck execution", {
          executionId: execution.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const sendingCutoff = new Date(now.getTime() - this.stuckSendingTimeoutMs);
    await this.service.reconcileStuckSendingExecutions(sendingCutoff);
  }
}
