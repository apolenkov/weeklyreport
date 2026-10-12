import type { OnModuleDestroy } from "@nestjs/common";
import { QUEUE_NAMES, type QueueName } from "@weeklyreport/shared";
import type { Queue } from "bullmq";

import { closeBullMqResource } from "./bounded-shutdown.js";

// Provides named access to the handles BullModule already owns, so inspectors
// and bootstrap producers reuse Nest's connections and shutdown lifecycle.
export class QueueRegistry implements OnModuleDestroy {
  private readonly queues: ReadonlyMap<QueueName, Queue>;

  constructor(handles: readonly Queue[]) {
    if (handles.length !== QUEUE_NAMES.length) {
      throw new Error(
        `Expected ${QUEUE_NAMES.length} queue handles, received ${handles.length}`,
      );
    }
    this.queues = new Map(
      QUEUE_NAMES.map((name, index) => {
        const queue = handles.at(index);
        if (!queue) throw new Error(`Missing queue handle for '${name}'`);
        return [name, queue] as const;
      }),
    );
  }

  readonly get = (name: QueueName): Queue => {
    const queue = this.queues.get(name);
    // QUEUE_NAMES is exhaustive over QueueName, so the handle always exists;
    // the guard narrows Map#get's union without a non-null assertion.
    if (!queue) throw new Error(`No queue handle registered for '${name}'`);
    return queue;
  };

  readonly names = QUEUE_NAMES;

  /** Close all producer handles within one bounded shutdown window. */
  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.queues.entries()].map(([name, queue]) =>
        closeBullMqResource(
          `queue ${name}`,
          () => queue.close(),
          () => queue.disconnect(),
        ),
      ),
    );
  }
}

export { QUEUE_NAMES };
export type { QueueName };
