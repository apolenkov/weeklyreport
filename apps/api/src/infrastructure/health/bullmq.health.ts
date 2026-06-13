import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";

@Injectable()
export class BullMQHealthIndicator {
  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: Queue,
    @InjectQueue("email-reminder") private readonly emailQueue: Queue,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const [pdfCounts, emailCounts] = await Promise.all([
        this.pdfQueue.getJobCounts(),
        this.emailQueue.getJobCounts(),
      ]);

      return this.healthIndicator.check(key).up({
        pdf_export: { waiting: pdfCounts.waiting, active: pdfCounts.active },
        email_reminder: {
          waiting: emailCounts.waiting,
          active: emailCounts.active,
        },
      });
    } catch (error) {
      return this.healthIndicator
        .check(key)
        .down({ message: (error as Error).message });
    }
  }
}
