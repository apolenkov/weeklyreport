import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";

const QUEUE_NAMES = [
  "email-reminder",
  "pdf-export",
  // telegram-outbound is seeds-only until the bot activates. Its handle exists
  // now so the admin smoke-test enqueue and the DLQ monitor share one
  // connection the moment the feature turns on.
  "telegram-outbound",
] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

/**
 * Single owner of the raw `Queue` handles for this process. The DLQ monitor,
 * Bull Board, and the admin bootstrap queues all inject one shared handle per
 * name instead of each opening its own Redis connection for the same queue.
 * Handles are built eagerly (a Queue is a lightweight producer/inspector) and
 * closed together on shutdown.
 */
@Injectable()
export class QueueRegistry implements OnModuleDestroy {
  // Built in the constructor (not a field initializer) because an ES2022
  // class-field initializer cannot read the injected `env` constructor param.
  private readonly queues: ReadonlyMap<QueueName, Queue>;

  constructor(env: EnvConfig) {
    const options = getBullMQOptions(env);
    this.queues = new Map(
      QUEUE_NAMES.map((name) => [name, new Queue(name, options)] as const),
    );
  }

  get(name: QueueName): Queue {
    const queue = this.queues.get(name);
    // QUEUE_NAMES is exhaustive over QueueName, so the handle always exists;
    // the guard narrows Map#get's union without a non-null assertion.
    if (!queue) throw new Error(`No queue handle registered for '${name}'`);
    return queue;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}

export { QUEUE_NAMES };
export type { QueueName };
