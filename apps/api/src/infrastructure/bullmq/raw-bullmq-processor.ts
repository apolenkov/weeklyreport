import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { type Job, Worker, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import type { AppLogger } from "../../lib/logger.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import type { QueueName } from "./queue-registry";
import {
  type JobTraceContext,
  runInJobTraceContext,
} from "./worker-observability.js";

// Raw `Worker` (not @Processor/WorkerHost) avoids the DiscoveryService DI bug
// in @nestjs/bullmq 11 with NestJS 11. Subclass supplies queue/span/handler.
class WorkerLifecycle<TData> {
  private worker: Worker<TData> | null = null;

  readonly start = (worker: Worker<TData>): void => {
    if (this.worker) throw new Error("BullMQ worker is already running");
    this.worker = worker;
  };

  readonly close = async (): Promise<void> => {
    const worker = this.worker;
    this.worker = null;
    await worker?.close();
  };
}

export abstract class RawBullMqProcessor<TData extends JobTraceContext>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly lifecycle = new WorkerLifecycle<TData>();

  constructor(
    protected readonly env: EnvConfig,
    protected readonly logger: AppLogger,
    protected readonly cls: ClsService | null,
  ) {}

  // QueueName (not string): a subclass typo cannot spin up a worker on a
  // queue the registry does not own.
  protected abstract readonly queueName: QueueName;
  protected abstract readonly spanName: string;
  protected abstract readonly processJob: (job: Job<TData>) => Promise<void>;
  protected abstract readonly onJobFailed: (
    job: Job<TData> | undefined,
    error: Error,
  ) => void;

  protected readonly extraWorkerOptions = (): Partial<WorkerOptions> => ({});

  readonly onModuleInit = (): void => {
    const worker = new Worker<TData>(
      this.queueName,
      (job: Job<TData>) =>
        runInJobTraceContext(job.data, this.spanName, this.cls, async () => {
          try {
            await this.processJob(job);
          } catch (error) {
            Sentry.captureException(error);
            throw error;
          }
        }),
      { ...getBullMQOptions(this.env), ...this.extraWorkerOptions() },
    );

    worker.on("failed", (job, error) => {
      this.onJobFailed(job, error);
    });
    worker.on("error", (error) => {
      this.logger.error("BullMQ worker connection error", {
        queueName: this.queueName,
        message: error.message,
      });
    });
    this.lifecycle.start(worker);
  };

  readonly onModuleDestroy = async (): Promise<void> => this.lifecycle.close();
}
