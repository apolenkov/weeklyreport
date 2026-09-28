import type { BaseAdapter } from "@bull-board/api/baseAdapter";
import { retryJobHandler } from "@bull-board/api/dist/handlers/retryJob.js";
import {
  EMAIL_REMINDER_QUEUE_NAME,
  PDF_EXPORT_QUEUE_NAME,
  QUEUE_NAMES,
} from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { SessionRevocationService } from "../../modules/admin/index.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "../prisma/prisma.service";
import { mountBullBoard } from "./bull-board.module.js";
import { QueueRegistry } from "./queue-registry.js";

// recover-orphaned-pdf-exports requires every manual PDF retry to run the
// generation transition, so the board's direct job.retry() endpoint must be
// unreachable for pdf-export; the head-only guard only limits who can mount
// the board. The test drives the real BullMQAdapter/queueProvider pair: stub
// Queue handles carry metaValues so the adapter's BullMQ check passes, and a
// createBullBoard spy is the only seam that observes the registered adapters.

const captured = vi.hoisted(() => ({
  queues: undefined as readonly BaseAdapter[] | undefined,
}));

vi.mock("@bull-board/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bull-board/api")>();
  return {
    ...actual,
    createBullBoard: ({ queues }: { queues: readonly BaseAdapter[] }) => {
      captured.queues = queues;
      return {
        setQueues: () => undefined,
        replaceQueues: () => undefined,
        addQueue: () => undefined,
        removeQueue: () => undefined,
      };
    },
  };
});

const stubHandles = QUEUE_NAMES.map(
  (name) =>
    ({ name, metaValues: { version: "bullmq/6.3.2" } }) as unknown as Queue,
);

const env = { AUTH_JWT_SECRET: "s".repeat(32) } as unknown as EnvConfig;

function buildApp(registry: QueueRegistry): INestApplication {
  return {
    get: (token: unknown) => {
      if (token === QueueRegistry) return registry;
      if (token === PrismaService) return {} as PrismaService;
      if (token === SessionRevocationService) {
        return {} as SessionRevocationService;
      }
      throw new Error("unexpected app.get token");
    },
    getHttpAdapter: () => ({
      getInstance: () => ({ use: vi.fn() }),
    }),
  } as unknown as INestApplication;
}

type BoardRequest = Parameters<typeof retryJobHandler>[0];

function boardRequest(queueName: string, adapter: BaseAdapter): BoardRequest {
  return {
    queues: new Map([[queueName, adapter]]),
    uiConfig: {},
    query: {},
    params: { queueName, jobId: "job-1" },
    body: {},
    headers: {},
  };
}

describe("mountBullBoard", () => {
  it("registers pdf-export read-only so its write endpoints refuse writes, while other queues keep write access", async () => {
    mountBullBoard(buildApp(new QueueRegistry(stubHandles)), env);

    const byName = new Map(
      (captured.queues ?? []).map((adapter) => [adapter.getName(), adapter]),
    );
    expect(new Set(byName.keys())).toEqual(new Set(QUEUE_NAMES));

    const pdfAdapter = byName.get(PDF_EXPORT_QUEUE_NAME);
    if (!pdfAdapter) throw new Error("pdf-export adapter missing");
    expect(pdfAdapter.readOnlyMode).toBe(true);

    // The installed queueProvider answers 405 before job.retry() runs — the
    // write is refused by the route, not merely hidden in the UI.
    const denied = await retryJobHandler(
      boardRequest(PDF_EXPORT_QUEUE_NAME, pdfAdapter),
    );
    expect(denied.status).toBe(405);
    expect(denied.body).toMatchObject({
      error: { key: "ERRORS.QUEUE_READ_ONLY" },
    });

    for (const name of QUEUE_NAMES) {
      if (name === PDF_EXPORT_QUEUE_NAME) continue;
      expect(byName.get(name)?.readOnlyMode).toBe(false);
    }

    // On a writable queue the same request clears the read-only gate and only
    // fails later inside the stubbed handle — the gate is queue-scoped.
    const reminderAdapter = byName.get(EMAIL_REMINDER_QUEUE_NAME);
    if (!reminderAdapter) throw new Error("email-reminder adapter missing");
    await expect(
      retryJobHandler(boardRequest(EMAIL_REMINDER_QUEUE_NAME, reminderAdapter)),
    ).rejects.toThrow("getJob");
  });
});
