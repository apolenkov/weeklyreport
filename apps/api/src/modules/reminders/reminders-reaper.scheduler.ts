import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersService } from "./reminders.service";

/**
 * Periodic sweep that re-enqueues reminder executions stranded in `queued`. It
 * reclaims ONLY `queued` rows — a `sending` row is an in-flight send and
 * re-enqueuing it would risk a duplicate, so it is deliberately left untouched
 * (an accepted, observable residual). Re-enqueue is safe against a late
 * original: the deterministic jobId dedups at the queue and the worker's
 * compare-and-set send guard delivers exactly once.
 */
@Injectable()
export class RemindersReaperScheduler {
  private readonly logger = new Logger(RemindersReaperScheduler.name);

  // A reminder execution committed `queued` whose enqueue never happened (the
  // pod died between the DB insert and `emailQueue.add`) leaves no job and no
  // `failed` marker; its pinned dedupeKey never advances, so nothing else
  // re-enqueues it. Any row still `queued` this long after creation is treated
  // as stranded — well past the seconds-scale insert→enqueue window, yet healed
  // within one sweep interval. 15 minutes, in milliseconds.
  private readonly stuckQueuedTimeoutMs = 900_000;

  constructor(
    private readonly service: RemindersService,
    private readonly repository: RemindersPrismaRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reapStuckQueued(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Scheduler-internal entry point. Exposed for unit tests so the sweep can be
   * driven deterministically with a stubbed `now`.
   */
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
  }
}
