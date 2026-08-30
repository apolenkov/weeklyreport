import type { Queue } from "bullmq";

const QUEUE_NAMES = ["email-reminder", "pdf-export"] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

// Provides named access to the handles BullModule already owns, so inspectors
// and bootstrap producers reuse Nest's connections and shutdown lifecycle.
export class QueueRegistry {
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
}

export { QUEUE_NAMES };
export type { QueueName };
