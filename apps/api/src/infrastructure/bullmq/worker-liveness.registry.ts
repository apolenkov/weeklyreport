import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, type QueueName } from "./queue-registry.js";

type WorkerReadinessState =
  "starting" | "ready" | "unready" | "paused" | "stopped";

interface WorkerRuntimeHandle {
  readonly isPaused: () => boolean;
  readonly isRunning: () => boolean;
}

interface WorkerRecord {
  readonly token: symbol;
  readonly worker: WorkerRuntimeHandle;
  state: WorkerReadinessState;
}

export interface WorkerLivenessRegistration {
  readonly markReady: () => void;
  readonly markUnready: () => void;
  readonly markPaused: () => void;
  readonly markStopped: () => void;
}

export interface RequiredWorkerReadiness {
  readonly ready: boolean;
  readonly workers: Readonly<Record<QueueName, WorkerReadinessState>>;
}

@Injectable()
export class WorkerLivenessRegistry {
  private readonly records = new Map<QueueName, WorkerRecord>();

  readonly register = (
    queueName: QueueName,
    worker: WorkerRuntimeHandle,
  ): WorkerLivenessRegistration => {
    const token = Symbol(queueName);
    this.records.set(queueName, { token, worker, state: "starting" });
    const update = (state: WorkerReadinessState): void => {
      const current = this.records.get(queueName);
      if (
        current?.token === token &&
        (current.state !== "stopped" || state === "stopped")
      ) {
        current.state = state;
      }
    };
    return {
      markReady: () => update("ready"),
      markUnready: () => update("unready"),
      markPaused: () => update("paused"),
      markStopped: () => update("stopped"),
    };
  };

  readonly requiredWorkers = (): RequiredWorkerReadiness => {
    const workers = Object.fromEntries(
      QUEUE_NAMES.map((queueName) => [
        queueName,
        this.currentState(this.records.get(queueName)),
      ]),
    ) as Record<QueueName, WorkerReadinessState>;
    return {
      ready: QUEUE_NAMES.every((queueName) => workers[queueName] === "ready"),
      workers,
    };
  };

  private readonly currentState = (
    record: WorkerRecord | undefined,
  ): WorkerReadinessState => {
    if (!record || record.state === "stopped") return "stopped";
    if (record.state !== "ready") return record.state;
    if (record.worker.isPaused()) return "paused";
    return record.worker.isRunning() ? "ready" : "stopped";
  };
}
