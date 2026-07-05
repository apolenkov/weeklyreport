import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { type Job, Worker, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import type { QueueName } from "./queue-registry";
import {
  type JobTraceContext,
  runInJobTraceContext,
} from "./worker-observability.js";

/**
 * Shared lifecycle for the raw-BullMQ workers. Each worker uses a raw `Worker`
 * (not @Processor/WorkerHost) to avoid the DiscoveryService DI bug in
 * @nestjs/bullmq 11 with NestJS 11; this base owns that construction, the
 * trace/CLS wrapping, and the module lifecycle so a subclass supplies only its
 * queue name, span name, handler, failure hook, and any extra worker options.
 */
export abstract class RawBullMqProcessor<TData extends JobTraceContext>
  implements OnModuleInit, OnModuleDestroy
{
  private worker: Worker<TData> | undefined;
  protected readonly logger: AppLogger;

  constructor(
    private readonly env: EnvConfig,
    logger: AppLogger | undefined,
    protected readonly cls: ClsService | undefined,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  // QueueName (not string): a subclass typo cannot spin up a worker on a
  // queue the registry does not own.
  protected abstract readonly queueName: QueueName;
  protected abstract readonly spanName: string;
  protected abstract processJob(job: Job<TData>): Promise<void>;
  protected abstract onJobFailed(
    job: Job<TData> | undefined,
    error: Error,
  ): void;

  /** Worker options merged over the shared connection/prefix (concurrency, limiter, …). */
  protected extraWorkerOptions(): Partial<WorkerOptions> {
    return {};
  }

  onModuleInit(): void {
    this.worker = new Worker<TData>(
      this.queueName,
      (job: Job<TData>) =>
        runInJobTraceContext(job.data, this.spanName, this.cls, () =>
          this.processJob(job),
        ),
      { ...getBullMQOptions(this.env), ...this.extraWorkerOptions() },
    );

    this.worker.on("failed", (job, error) => {
      this.onJobFailed(job, error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
