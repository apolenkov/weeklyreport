import type { ItemOutcomeResult } from "@customreport/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import pg from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { requireEnv } from "../../../lib/env.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  assertTestDatabaseUrl,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper.js";
import {
  assignOutcomeStage,
  OUTCOME_STAGE,
  outcomeCommand,
  prepareOutcomeSource,
} from "./item-outcome.integration.fixtures.js";
import { resolvePlanTx, restorePlanTx } from "./item-outcome.transaction.js";
import { applySaveSection } from "./save-section.transaction.js";

const OUTCOME_TX_TIMEOUT_MS = 15_000;
const FAILURE_BOUND_MS = 25_000;
const LOCK_POLL_MS = 25;
const LOCK_ORACLE_TIMEOUT_MS = 5000;
const FAILURE_SQL = "SELECT 1 / 0";

type TestData = Awaited<ReturnType<typeof seedTestData>>;
interface TransactionOptions {
  readonly maxWait?: number;
  readonly timeout?: number;
  readonly isolationLevel?: Prisma.TransactionIsolationLevel;
}
type InteractiveTransaction = <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions,
) => Promise<T>;

interface LockObservation {
  readonly blockerHasReportRowShareLock: boolean;
  readonly blockerState: string;
  readonly blockingPids: number[];
  readonly holderMode: string;
  readonly lockType: string;
  readonly transactionId: string;
  readonly waitEventType: string;
  readonly waitingMode: string;
}

function wrapTransaction(
  prisma: PrismaClient,
  body: <T>(
    tx: Prisma.TransactionClient,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>,
): PrismaService {
  const transaction = prisma.$transaction.bind(
    prisma,
  ) as InteractiveTransaction;
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "$transaction") {
        return <T>(
          callback: (tx: Prisma.TransactionClient) => Promise<T>,
          options?: TransactionOptions,
        ) => transaction((tx) => body(tx, callback), options);
      }
      return Reflect.get(target, property, target) as unknown;
    },
  }) as unknown as PrismaService;
}

function observeTransactionBackend(
  prisma: PrismaClient,
  observedPid: PromiseWithResolvers<number>,
): PrismaService {
  return wrapTransaction(prisma, async (tx, callback) => {
    const rows = await tx.$queryRaw<{ pid: number }[]>`
      SELECT pg_backend_pid()::int AS pid
    `;
    observedPid.resolve(expectDefined(rows[0]).pid);
    return callback(tx);
  });
}

function failAfterTransactionBody(
  prisma: PrismaClient,
  verifyWrites: (tx: Prisma.TransactionClient) => Promise<void>,
): PrismaService {
  return wrapTransaction(prisma, async (tx, callback) => {
    await callback(tx);
    await verifyWrites(tx);
    await tx.$queryRawUnsafe(FAILURE_SQL);
    throw new Error("Expected the injected PostgreSQL statement to fail.");
  });
}

async function within<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`${label} did not settle within ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  const error = await promise.then(
    () => {
      throw new Error("Expected operation to reject.");
    },
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}

async function waitForBlockedReportRow(
  oracle: pg.Client,
  waitingPid: number,
  blockerPid: number,
): Promise<LockObservation> {
  const deadline = Date.now() + LOCK_ORACLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await oracle.query<LockObservation>(
      `SELECT waiting.locktype AS "lockType",
              waiting.mode AS "waitingMode",
              waiting.transactionid::text AS "transactionId",
              holder.mode AS "holderMode",
              waiting_activity.wait_event_type AS "waitEventType",
              blocker_activity.state AS "blockerState",
              pg_blocking_pids(waiting.pid)::int[] AS "blockingPids",
              EXISTS (
                SELECT 1
                FROM pg_locks AS report_lock
                WHERE report_lock.pid = $2
                  AND report_lock.granted
                  AND report_lock.locktype = 'relation'
                  AND report_lock.mode = 'RowShareLock'
                  AND report_lock.relation = '"Report"'::regclass
              ) AS "blockerHasReportRowShareLock"
       FROM pg_locks AS waiting
       JOIN pg_locks AS holder
         ON holder.pid = $2
        AND holder.granted
        AND holder.locktype = waiting.locktype
        AND holder.transactionid = waiting.transactionid
       JOIN pg_stat_activity AS waiting_activity ON waiting_activity.pid = waiting.pid
       JOIN pg_stat_activity AS blocker_activity ON blocker_activity.pid = holder.pid
       WHERE waiting.pid = $1
         AND NOT waiting.granted
         AND waiting.locktype = 'transactionid'
         AND $2 = ANY(pg_blocking_pids(waiting.pid))
         AND waiting_activity.wait_event_type = 'Lock'
         AND waiting_activity.query LIKE '%FROM "Report"%'
         AND waiting_activity.query LIKE '%FOR UPDATE%'`,
      [waitingPid, blockerPid],
    );
    if (result.rows[0] !== undefined) return result.rows[0];
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  throw new Error(
    `Timed out after ${LOCK_ORACLE_TIMEOUT_MS}ms waiting for backend ${waitingPid} to block on the held Report row`,
  );
}

async function readFixtureState(prisma: PrismaClient, sectionId: string) {
  const [section, items, events, comments] = await Promise.all([
    prisma.reportSection.findUniqueOrThrow({ where: { id: sectionId } }),
    prisma.item.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { id: "asc" },
    }),
    prisma.itemOutcomeEvent.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { id: "asc" },
    }),
    prisma.recordComment.findMany({
      where: { item: { reportSectionId: sectionId } },
      orderBy: { id: "asc" },
    }),
  ]);
  return { section, items, events, comments };
}

async function cleanFixture(prisma: PrismaClient): Promise<void> {
  assertTestDatabaseUrl(requireEnv(process.env, "E2E_DATABASE_URL"));
  await prisma.report.deleteMany({ where: { id: TEST_IDS.report } });
  await prisma.stage.deleteMany({ where: { id: OUTCOME_STAGE.id } });
  await prisma.groupProduct.deleteMany({
    where: { productId: TEST_IDS.project },
  });
  await prisma.project.deleteMany({ where: { id: TEST_IDS.project } });
  await prisma.user.deleteMany({
    where: { id: { in: [TEST_IDS.head, TEST_IDS.lead] } },
  });
  await prisma.reportingGroup.deleteMany({ where: { id: TEST_IDS.group } });
}

function resolvedItem(result: ItemOutcomeResult) {
  return expectDefined(
    result.section.items.find((item) => item.stableId === result.stableId),
  );
}

describe("item outcome operational recovery (real PostgreSQL)", () => {
  const prisma = createTestPrisma();
  const prismaService = prisma as unknown as PrismaService;
  let testData: TestData;

  beforeEach(async () => {
    await cleanFixture(prisma);
    testData = await seedTestData(prisma);
    await assignOutcomeStage(prisma, testData);
  });

  afterEach(async () => {
    await cleanFixture(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it.each(["resolve", "restore"] as const)(
    "times out on a proven Report row-lock wait for %s, rolls back, then retries the same command",
    async (operation) => {
      const prepared = await prepareOutcomeSource(prisma, testData, "current");
      let execute: (client: PrismaService) => Promise<ItemOutcomeResult>;
      if (operation === "resolve") {
        const command = outcomeCommand(
          testData.section.id,
          prepared.source,
          "done",
        );
        execute = (client) => resolvePlanTx(client, command, testData.lead.id);
      } else {
        const cancelled = await resolvePlanTx(
          prismaService,
          outcomeCommand(testData.section.id, prepared.source, "wont_do"),
          testData.lead.id,
        );
        const cancelledItem = resolvedItem(cancelled);
        const command = {
          reportSectionId: testData.section.id,
          version: cancelled.section.version,
          commandId: crypto.randomUUID(),
          recordId: expectDefined(cancelledItem.id),
        };
        execute = (client) => restorePlanTx(client, command, testData.lead.id);
      }
      const before = await readFixtureState(prisma, testData.section.id);
      const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
      assertTestDatabaseUrl(databaseUrl);
      const blocker = new pg.Client({ connectionString: databaseUrl });
      const oracle = new pg.Client({ connectionString: databaseUrl });
      const observedPid = Promise.withResolvers<number>();
      let attempt:
        | Promise<
            | { readonly kind: "resolved"; readonly value: ItemOutcomeResult }
            | { readonly error: unknown; readonly kind: "rejected" }
          >
        | undefined;
      let observation: LockObservation | undefined;
      let outcome:
        | { readonly kind: "resolved"; readonly value: ItemOutcomeResult }
        | { readonly error: unknown; readonly kind: "rejected" }
        | undefined;
      let blockerPid: number | undefined;
      let elapsedMs = 0;

      try {
        await Promise.all([blocker.connect(), oracle.connect()]);
        await blocker.query("BEGIN");
        blockerPid = expectDefined(
          (
            await blocker.query<{ pid: number }>(
              "SELECT pg_backend_pid()::int AS pid",
            )
          ).rows[0],
        ).pid;
        await blocker.query(
          'SELECT "id" FROM "Report" WHERE "id" = $1 FOR UPDATE',
          [testData.report.id],
        );

        const startedAt = Date.now();
        attempt = execute(observeTransactionBackend(prisma, observedPid)).then(
          (value) => ({ kind: "resolved", value }) as const,
          (error: unknown) => ({ kind: "rejected", error }) as const,
        );
        const waitingPid = await within(
          observedPid.promise,
          LOCK_ORACLE_TIMEOUT_MS,
          `${operation}PlanTx backend observation`,
        );
        observation = await waitForBlockedReportRow(
          oracle,
          waitingPid,
          blockerPid,
        );
        outcome = await within(
          attempt,
          FAILURE_BOUND_MS,
          `${operation}PlanTx lock-timeout attempt`,
        );
        elapsedMs = Date.now() - startedAt;
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        if (attempt !== undefined) {
          await within(
            attempt,
            LOCK_ORACLE_TIMEOUT_MS,
            `${operation}PlanTx cleanup settlement`,
          ).catch(() => undefined);
        }
        await Promise.allSettled([blocker.end(), oracle.end()]);
      }

      const knownBlockerPid = expectDefined(blockerPid);
      const observedLock = expectDefined(observation);
      const settledOutcome = expectDefined(outcome);
      expect(observedLock).toMatchObject({
        blockerHasReportRowShareLock: true,
        blockerState: "idle in transaction",
        holderMode: "ExclusiveLock",
        lockType: "transactionid",
        waitEventType: "Lock",
        waitingMode: "ShareLock",
      });
      expect(observedLock.blockingPids).toContain(knownBlockerPid);
      expect(settledOutcome.kind).toBe("rejected");
      const timeoutError = (
        settledOutcome as { readonly error: unknown; readonly kind: "rejected" }
      ).error;
      expect(timeoutError).toBeInstanceOf(Error);
      expect((timeoutError as Error).message).toMatch(
        /transaction|timed out|timeout|expired|closed|cancel/iu,
      );
      expect(elapsedMs).toBeGreaterThanOrEqual(OUTCOME_TX_TIMEOUT_MS - 500);
      expect(elapsedMs).toBeLessThan(FAILURE_BOUND_MS);
      await expect(
        readFixtureState(prisma, testData.section.id),
      ).resolves.toEqual(before);

      const retried = await execute(prismaService);
      expect(retried).toMatchObject({ replayed: false });
      expect(retried.section.version).toBe(operation === "resolve" ? 2 : 3);
      if (operation === "resolve") {
        expect(resolvedItem(retried).workflowStatus).toBe("done");
      } else {
        expect(resolvedItem(retried).resolution).toBeNull();
      }
      await expect(
        prisma.itemOutcomeEvent.count({
          where: { reportSectionId: testData.section.id },
        }),
      ).resolves.toBe(operation === "resolve" ? 1 : 2);
    },
    35_000,
  );

  it("rolls back a real SQL failure after outcome writes, then retries the same command", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const command = outcomeCommand(
      testData.section.id,
      prepared.source,
      "wont_do",
    );
    const before = await readFixtureState(prisma, testData.section.id);
    const faultedPrisma = failAfterTransactionBody(prisma, async (tx) => {
      const [section, event, item] = await Promise.all([
        tx.reportSection.findUniqueOrThrow({
          where: { id: testData.section.id },
          select: { version: true },
        }),
        tx.itemOutcomeEvent.findUnique({ where: { id: command.commandId } }),
        tx.item.findUniqueOrThrow({
          where: {
            reportSectionId_stableId: {
              reportSectionId: testData.section.id,
              stableId: prepared.item.stableId,
            },
          },
        }),
      ]);
      expect(section.version).toBe(2);
      expect(event).toMatchObject({
        id: command.commandId,
        outcome: "wont_do",
      });
      expect(item.resolution).not.toBeNull();
    });

    const failure = await captureError(
      resolvePlanTx(faultedPrisma, command, testData.lead.id),
    );
    expect(failure.message).toMatch(/division by zero/iu);
    await expect(
      readFixtureState(prisma, testData.section.id),
    ).resolves.toEqual(before);

    const retried = await resolvePlanTx(
      prismaService,
      command,
      testData.lead.id,
    );
    expect(retried).toMatchObject({ replayed: false });
    expect(retried.section.version).toBe(2);
    expect(resolvedItem(retried).resolution).not.toBeNull();
    await expect(
      prisma.itemOutcomeEvent.count({ where: { id: command.commandId } }),
    ).resolves.toBe(1);
  });

  it("rolls back post-remint save state and comment anchors, then retries", async () => {
    const prepared = await prepareOutcomeSource(prisma, testData, "current");
    const cancelled = await resolvePlanTx(
      prismaService,
      outcomeCommand(testData.section.id, prepared.source, "wont_do"),
      testData.lead.id,
    );
    const originalItem = resolvedItem(cancelled);
    const comment = await prisma.recordComment.create({
      data: {
        reviewerId: testData.head.id,
        itemId: expectDefined(originalItem.id),
        text: "Keep this cancellation context",
      },
    });
    const before = await readFixtureState(prisma, testData.section.id);

    const failure = await captureError(
      prisma.$transaction(
        async (tx) => {
          const saved = await applySaveSection(
            tx,
            cancelled.section,
            cancelled.section.version,
          );
          const reminted = expectDefined(saved.items[0]);
          expect(saved.version).toBe(cancelled.section.version + 1);
          expect(reminted.id).not.toBe(originalItem.id);
          expect(reminted.resolution).toEqual(originalItem.resolution);
          await expect(
            tx.recordComment.findFirstOrThrow({
              where: {
                itemId: expectDefined(reminted.id),
                reviewerId: comment.reviewerId,
              },
              select: { itemId: true, text: true },
            }),
          ).resolves.toEqual({
            itemId: reminted.id,
            text: comment.text,
          });
          await tx.$queryRawUnsafe(FAILURE_SQL);
          throw new Error(
            "Expected the injected PostgreSQL statement to fail.",
          );
        },
        { timeout: OUTCOME_TX_TIMEOUT_MS },
      ),
    );
    expect(failure.message).toMatch(/division by zero/iu);
    await expect(
      readFixtureState(prisma, testData.section.id),
    ).resolves.toEqual(before);

    const saved = await prisma.$transaction(
      (tx) =>
        applySaveSection(tx, cancelled.section, cancelled.section.version),
      { timeout: OUTCOME_TX_TIMEOUT_MS },
    );
    const reminted = expectDefined(saved.items[0]);
    expect(saved.version).toBe(cancelled.section.version + 1);
    expect(reminted.id).not.toBe(originalItem.id);
    expect(reminted.resolution).toEqual(originalItem.resolution);
    await expect(
      prisma.recordComment.findFirstOrThrow({
        where: {
          itemId: expectDefined(reminted.id),
          reviewerId: comment.reviewerId,
        },
        select: { itemId: true, text: true },
      }),
    ).resolves.toEqual({ itemId: reminted.id, text: comment.text });
  });
});
