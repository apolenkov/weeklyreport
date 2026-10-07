import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { type Job, Worker, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import type { AppLogger } from "../../lib/logger.js";
import type { EnvConfig } from "../config/env.schema";
import { closeBullMqResource } from "./bounded-shutdown.js";
import { getBullMQOptions } from "./bullmq-options";
import type { QueueName } from "./queue-registry";
import type {
  WorkerLivenessRegistration,
  WorkerLivenessRegistry,
} from "./worker-liveness.registry.js";
import {
  type JobTraceContext,
  runInJobTraceContext,
} from "./worker-observability.js";

// Raw `Worker` owns one explicit lifecycle for CLS/Sentry wrapping, liveness,
// and the failure hook. Subclasses supply only queue, span, and handler policy.
class WorkerLifecycle<TData> {
  private worker: Worker<TData> | null = null;

  readonly start = (worker: Worker<TData>): void => {
    if (this.worker) throw new Error("BullMQ worker is already running");
    this.worker = worker;
  };

  readonly close = async (): Promise<void> => {
    const worker = this.worker;
    this.worker = null;
    if (!worker) return;
    await closeBullMqResource(
      "worker",
      () => worker.close(),
      () => worker.close(true),
    );
  };
}

export abstract class RawBullMqProcessor<TData extends JobTraceContext>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly lifecycle = new WorkerLifecycle<TData>();
  private registration: WorkerLivenessRegistration | null = null;

  constructor(
    protected readonly env: EnvConfig,
    protected readonly logger: AppLogger,
    protected readonly cls: ClsService | null,
    private readonly workerLiveness?: WorkerLivenessRegistry,
  ) {}

  // QueueName (not string): a subclass typo cannot spin up a worker on a
  // queue the registry does not own.
  protected abstract readonly queueName: QueueName;
  protected abstract readonly spanName: string;
  protected abstract readonly processJob: (job: Job<TData>) => Promise<unknown>;
  protected abstract readonly onJobFailed: (
    job: Job<TData> | undefined,
    error: Error,
  ) => void | Promise<void>;

  protected readonly extraWorkerOptions = (): Partial<WorkerOptions> => ({});

  readonly onModuleInit = (): void => {
    const worker = new Worker<TData>(
      this.queueName,
      (job: Job<TData>) =>
        runInJobTraceContext(job.data, this.spanName, this.cls, async () => {
          try {
            return await this.processJob(job);
          } catch (error) {
            Sentry.captureException(error);
            throw error;
          }
        }),
      { ...getBullMQOptions(this.env), ...this.extraWorkerOptions() },
    );

    worker.on("failed", (job, error) => {
      void runInJobTraceContext(
        job?.data,
        `${this.spanName}.failed`,
        this.cls,
        async () => {
          try {
            await this.onJobFailed(job, error);
          } catch (failureHandlerError) {
            Sentry.captureException(failureHandlerError);
          }
        },
      );
    });
    this.lifecycle.start(worker);
    const registration = this.workerLiveness?.register(this.queueName, worker);
    this.registration = registration ?? null;
    const recoverWhenReady = (): void => {
      registration?.markUnready();
      void worker
        .waitUntilReady()
        .then(() => registration?.markReady())
        .catch(() => undefined);
    };
    worker.on("ready", () => registration?.markReady());
    worker.on("error", (error) => {
      recoverWhenReady();
      this.logger.error("BullMQ worker connection error", {
        queueName: this.queueName,
        message: error.message,
      });
    });
    worker.on("paused", () => registration?.markPaused());
    worker.on("resumed", recoverWhenReady);
    worker.on("closing", () => registration?.markStopped());
    worker.on("closed", () => registration?.markStopped());
  };

  readonly onModuleDestroy = async (): Promise<void> => {
    this.registration?.markStopped();
    this.registration = null;
    await this.lifecycle.close();
  };
}
