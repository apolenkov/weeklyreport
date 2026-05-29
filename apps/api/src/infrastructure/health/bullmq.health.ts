import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthCheckError, HealthIndicator } from "@nestjs/terminus";
import type { Queue } from "bullmq";

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: Queue,
    @InjectQueue("email-reminder") private readonly emailQueue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const [pdfCounts, emailCounts] = await Promise.all([
        this.pdfQueue.getJobCounts(),
        this.emailQueue.getJobCounts(),
      ]);

      return this.getStatus(key, true, {
        pdf_export: { waiting: pdfCounts.waiting, active: pdfCounts.active },
        email_reminder: {
          waiting: emailCounts.waiting,
          active: emailCounts.active,
        },
      });
    } catch (error) {
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
