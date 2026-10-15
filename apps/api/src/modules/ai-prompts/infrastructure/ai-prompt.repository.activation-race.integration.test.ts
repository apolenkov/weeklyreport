import { AiPromptBundleLifecycle, Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "../application/ai-feature-prompt-catalog.js";
import { AiPromptRepository } from "./ai-prompt.repository.js";

const prisma = createTestPrisma();
const repository = new AiPromptRepository(prisma as unknown as PrismaService);
const featureKey = "lead-report-assistant" as const;
const now = new Date("2026-08-11T00:00:00.000Z");
const baseline = baselineReportAssistantPrompts();
const ACTIVATION = [
  AiPromptBundleLifecycle.draft,
  AiPromptBundleLifecycle.validated,
  AiPromptBundleLifecycle.failed,
  AiPromptBundleLifecycle.active,
];
const RESTORE = [AiPromptBundleLifecycle.superseded];

const activation = (allowedLifecycle: AiPromptBundleLifecycle[]) => ({
  allowedLifecycle,
  now,
  contract: { servingContractVersion: baseline.servingContractVersion },
});

const createRevision = async (
  revision: number,
  lifecycle: AiPromptBundleLifecycle,
) =>
  prisma.aiPromptBundleRevision.create({
    data: {
      id: `a0000000-0000-4000-8000-00000000c00${revision}`,
      featureKey,
      revision,
      coreContractVersion: baseline.coreContractVersion,
      composerVersion: baseline.composerVersion,
      servingContractVersion: baseline.servingContractVersion,
      lockedCoreSnapshot: Object.fromEntries(
        baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
      ),
      promptContents:
        aiFeaturePromptCatalog.require(featureKey).defaultEditableInstructions,
      effectiveContentHash: `${baseline.contentHash}-${revision}`,
      lifecycle,
      createdBy: "test",
    },
  });

const withinTimeout = async <T>(pending: Promise<T>): Promise<T> => {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(() => {
    timeout.reject(new Error("Activation race barrier timed out"));
  }, 5000);
  try {
    return await Promise.race([pending, timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
};

// Pauses one activation inside its transaction before each revision write, so
// the test can order the competing transactions deterministically.
const pausedActivationClient = (pauses: readonly (() => Promise<void>)[]) =>
  new Proxy(prisma, {
    get(target, property) {
      if (property !== "$transaction") {
        return Reflect.get(target, property, target) as unknown;
      }
      return (
        callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        options: Parameters<typeof prisma.$transaction>[1],
      ) =>
        prisma.$transaction((transaction) => {
          const writes = { count: 0 };
          const revisions = new Proxy(transaction.aiPromptBundleRevision, {
            get(delegate, method) {
              if (method !== "updateMany") {
                return Reflect.get(delegate, method, delegate) as unknown;
              }
              return async (
                ...args: Parameters<typeof delegate.updateMany>
              ) => {
                await pauses[writes.count++]?.();
                return delegate.updateMany(...args);
              };
            },
          });
          return callback(
            new Proxy(transaction, {
              get: (client, key) =>
                key === "aiPromptBundleRevision"
                  ? revisions
                  : (Reflect.get(client, key, client) as unknown),
            }),
          );
        }, options);
    },
  });

const settle = (pending: Promise<boolean>) =>
  pending.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );

describe("AI prompt activation lock order (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  // C0854 / TASK-503.49: an activation that read the old pointer races an
  // activation of the same candidate and a restore of the old revision, the
  // schedule a review claims locks the two revisions in opposite order.
  it("settles a stale activation racing a restore of the previous revision without a database error", async () => {
    const previous = await createRevision(1, AiPromptBundleLifecycle.active);
    const candidate = await createRevision(2, AiPromptBundleLifecycle.draft);
    await prisma.aiFeaturePromptControl.create({
      data: {
        id: "a0000000-0000-4000-8000-00000000c0ff",
        featureKey,
        activeRevisionId: previous.id,
      },
    });
    const atCandidate = Promise.withResolvers<void>();
    const atSupersede = Promise.withResolvers<void>();
    const releaseCandidate = Promise.withResolvers<void>();
    const releaseSupersede = Promise.withResolvers<void>();
    const staleRepository = new AiPromptRepository(
      pausedActivationClient([
        async () => {
          atCandidate.resolve();
          await releaseCandidate.promise;
        },
        async () => {
          atSupersede.resolve();
          await releaseSupersede.promise;
        },
      ]) as unknown as PrismaService,
    );

    const stale = settle(
      staleRepository.activate(
        featureKey,
        candidate.id,
        activation(ACTIVATION),
      ),
    );
    const restore = Promise.withResolvers<{
      value?: boolean;
      error?: unknown;
    }>();
    try {
      // The stale activation has read pointer = previous and holds no row lock.
      await withinTimeout(atCandidate.promise);
      const winner = settle(
        repository.activate(featureKey, candidate.id, activation(ACTIVATION)),
      );
      // Without a control-row lock the winner commits here; with one it waits.
      await expect
        .poll(
          async () =>
            (
              await prisma.aiFeaturePromptControl.findUniqueOrThrow({
                where: { featureKey },
              })
            ).activeRevisionId === candidate.id || (await lockWaiters()) === 1,
          { timeout: 5000 },
        )
        .toBe(true);
      // The stale activation now holds the candidate row and pauses before it
      // supersedes the previous revision.
      releaseCandidate.resolve();
      await withinTimeout(atSupersede.promise);
      settle(
        repository.activate(featureKey, previous.id, activation(RESTORE)),
      ).then(restore.resolve, restore.reject);
      await expect.poll(lockWaiters, { timeout: 5000 }).toBeGreaterThan(0);
      releaseSupersede.resolve();
      const outcomes = await withinTimeout(
        Promise.all([stale, winner, restore.promise]),
      );

      expect(outcomes.filter((outcome) => "error" in outcome)).toEqual([]);
    } finally {
      releaseCandidate.resolve();
      releaseSupersede.resolve();
    }

    const active = await prisma.aiPromptBundleRevision.findMany({
      where: { featureKey, lifecycle: AiPromptBundleLifecycle.active },
      select: { id: true },
    });
    const control = await prisma.aiFeaturePromptControl.findUniqueOrThrow({
      where: { featureKey },
    });
    expect(active.map(({ id }) => id)).toEqual([control.activeRevisionId]);
  }, 20_000);
});

async function lockWaiters(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>(
    Prisma.sql`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  );
  return rows[0]?.count ?? 0;
}
