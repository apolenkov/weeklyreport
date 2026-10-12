import { readFile } from "node:fs/promises";

import type { Prisma, PrismaClient } from "@prisma/client";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { requireEnv } from "../../lib/env.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  assertTestDatabaseUrl,
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper.js";
import { AdminPrismaRepository } from "./admin.prisma-repository.js";
import { AdminUserConflictError } from "./admin-errors.js";

const HISTORY_KINDS = [
  "acknowledgement",
  "verdict",
  "comment",
  "reopen-approved",
  "reopen-rejected",
] as const;
type HistoryKind = (typeof HISTORY_KINDS)[number];

const LOCK_POLL_MS = 25;
const LOCK_WAIT_TIMEOUT_MS = 10_000;

type InteractiveTransaction = <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number },
) => Promise<T>;

// Resolves the backend PID of the next interactive transaction so the lock
// oracle can attribute an observed wait to this exact connection.
function observeTransactionBackend(
  prisma: PrismaClient,
  observedPid: PromiseWithResolvers<number>,
): PrismaService {
  const transaction = prisma.$transaction.bind(
    prisma,
  ) as InteractiveTransaction;
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "$transaction") {
        return <T>(
          callback: (tx: Prisma.TransactionClient) => Promise<T>,
          options?: { timeout?: number },
        ) =>
          transaction(async (tx) => {
            const rows = await tx.$queryRaw<{ pid: number }[]>`
              SELECT pg_backend_pid()::int AS pid
            `;
            observedPid.resolve(expectDefined(rows[0]).pid);
            return callback(tx);
          }, options);
      }
      return Reflect.get(target, property, target) as unknown;
    },
  }) as unknown as PrismaService;
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

// Polls PostgreSQL until `waitingPid` is verifiably blocked on `blockerPid` —
// elapsed time alone never proves a lock wait.
async function waitForLockWaiter(
  oracle: pg.Client,
  waitingPid: number,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const observed = await oracle.query<{ blocked: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_stat_activity AS activity
         WHERE activity.pid = $1
           AND activity.state = 'active'
           AND activity.wait_event_type = 'Lock'
       )
       AND EXISTS (
         SELECT 1 FROM pg_locks AS lock
         WHERE lock.pid = $1 AND NOT lock.granted
       )
       AND $2::int = ANY (pg_blocking_pids($1::int)) AS blocked`,
      [waitingPid, blockerPid],
    );
    if (observed.rows[0]?.blocked === true) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  throw new Error(
    `Timed out after ${String(LOCK_WAIT_TIMEOUT_MS)}ms waiting for backend ${String(waitingPid)} to block on ${String(blockerPid)}`,
  );
}

describe("admin user deletion retains live reviewer history (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as unknown as PrismaService);
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let itemId: string;
  let subject: Awaited<ReturnType<typeof createReviewer>>;
  let unrelated: Awaited<ReturnType<typeof createReviewer>>;

  function createReviewer(label: string) {
    return prisma.user.create({
      data: {
        email: `${label}@test.local`,
        samlId: label,
        name: `History ${label}`,
        lastName: "History",
        firstName: label,
        role: "head",
        reportingGroupId: expectDefined(data.head.reportingGroupId),
      },
    });
  }

  async function addHistory(
    kind: (typeof HISTORY_KINDS)[number],
    reviewerId: string,
  ): Promise<void> {
    if (kind === "acknowledgement") {
      await prisma.reviewAcknowledgement.create({
        data: {
          userId: reviewerId,
          reportId: data.report.id,
          groupId: expectDefined(data.lead.reportingGroupId),
        },
      });
    } else if (kind === "verdict") {
      await prisma.sectionReview.create({
        data: {
          reviewerId,
          reportSectionId: data.section.id,
          judgedVersion: data.section.version,
          verdict: "approved",
        },
      });
    } else if (kind === "comment") {
      await prisma.recordComment.create({
        data: { reviewerId, itemId, text: "Retained review comment" },
      });
    } else {
      await prisma.reopenRequest.create({
        data: {
          reportSectionId: data.section.id,
          requestedById: data.lead.id,
          status: kind === "reopen-approved" ? "approved" : "rejected",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNote: "Retained reopen decision",
        },
      });
    }
  }

  function historyInsert(
    kind: HistoryKind,
    rowId: string,
    userId: string,
  ): { constraint: string; text: string; values: unknown[] } {
    if (kind === "acknowledgement") {
      return {
        constraint: "ReviewAcknowledgement_userId_fkey",
        text: 'INSERT INTO "ReviewAcknowledgement" ("id", "userId", "reportId", "groupId", "seenAt") VALUES ($1, $2, $3, $4, now())',
        values: [
          rowId,
          userId,
          data.report.id,
          expectDefined(data.lead.reportingGroupId),
        ],
      };
    }
    if (kind === "verdict") {
      return {
        constraint: "SectionReview_reviewerId_fkey",
        text: 'INSERT INTO "SectionReview" ("id", "reviewerId", "reportSectionId", "judgedVersion", "verdict", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'approved\', now(), now())',
        values: [rowId, userId, data.section.id, data.section.version],
      };
    }
    if (kind === "reopen-approved" || kind === "reopen-rejected") {
      return {
        constraint: "ReopenRequest_reviewedById_fkey",
        text: 'INSERT INTO "ReopenRequest" ("id", "reportSectionId", "requestedById", "status", "reviewedById", "reviewedAt", "reviewNote", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4::"ReopenRequestStatus", $5, now(), $6, now(), now())',
        values: [
          rowId,
          data.section.id,
          data.lead.id,
          kind === "reopen-approved" ? "approved" : "rejected",
          userId,
          "Retained reopen decision",
        ],
      };
    }
    return {
      constraint: "RecordComment_reviewerId_fkey",
      text: 'INSERT INTO "RecordComment" ("id", "reviewerId", "itemId", "text", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, now(), now())',
      values: [rowId, userId, itemId, "Retained review comment"],
    };
  }

  function historyRow(kind: HistoryKind, rowId: string) {
    if (kind === "acknowledgement") {
      return prisma.reviewAcknowledgement.findUnique({ where: { id: rowId } });
    }
    if (kind === "verdict") {
      return prisma.sectionReview.findUnique({ where: { id: rowId } });
    }
    if (kind === "comment") {
      return prisma.recordComment.findUnique({ where: { id: rowId } });
    }
    return prisma.reopenRequest.findUnique({ where: { id: rowId } });
  }

  function historyCount(kind: HistoryKind): Promise<number> {
    if (kind === "acknowledgement") return prisma.reviewAcknowledgement.count();
    if (kind === "verdict") return prisma.sectionReview.count();
    if (kind === "comment") return prisma.recordComment.count();
    return prisma.reopenRequest.count({
      where: {
        status: kind === "reopen-approved" ? "approved" : "rejected",
        reviewedById: { not: null },
      },
    });
  }

  async function readHistoryAndAnchors() {
    const [
      acknowledgements,
      verdicts,
      comments,
      reopenRequests,
      report,
      section,
      item,
      project,
    ] = await Promise.all([
      prisma.reviewAcknowledgement.findMany({ orderBy: { id: "asc" } }),
      prisma.sectionReview.findMany({ orderBy: { id: "asc" } }),
      prisma.recordComment.findMany({ orderBy: { id: "asc" } }),
      prisma.reopenRequest.findMany({ orderBy: { id: "asc" } }),
      prisma.report.findUniqueOrThrow({ where: { id: data.report.id } }),
      prisma.reportSection.findUniqueOrThrow({
        where: { id: data.section.id },
      }),
      prisma.item.findUniqueOrThrow({ where: { id: itemId } }),
      prisma.project.findUniqueOrThrow({ where: { id: data.project.id } }),
    ]);
    return {
      acknowledgements,
      verdicts,
      comments,
      reopenRequests,
      report,
      section,
      item,
      project,
    };
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
    const item = await prisma.item.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        type: "current",
        text: "Review anchor",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });
    itemId = item.id;
    subject = await createReviewer("subject");
    unrelated = await createReviewer("unrelated");
    for (const kind of HISTORY_KINDS) await addHistory(kind, unrelated.id);
    await prisma.reopenRequest.create({
      data: {
        reportSectionId: data.section.id,
        requestedById: data.lead.id,
        status: "rejected",
        reviewedById: null,
        reviewedAt: new Date(),
        reviewNote: "Legacy decision with an already absent author",
      },
    });
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it.each(HISTORY_KINDS)(
    "refuses deletion with only a live %s reference and permits deactivation",
    async (kind) => {
      await addHistory(kind, subject.id);
      expect(
        await prisma.report.count({ where: { publishedById: subject.id } }),
      ).toBe(0);
      expect(
        await prisma.reportSection.count({ where: { authorId: subject.id } }),
      ).toBe(0);
      expect(
        await prisma.project.count({ where: { leadId: subject.id } }),
      ).toBe(0);
      const before = await readHistoryAndAnchors();

      const deletion = repo.removeUser(subject.id);
      await expect(deletion).rejects.toBeInstanceOf(AdminUserConflictError);
      await expect(deletion).rejects.toThrow(
        "User is referenced by existing records; deactivate the user instead.",
      );
      await expect(
        prisma.user.delete({ where: { id: subject.id } }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toEqual(subject);
      expect(await readHistoryAndAnchors()).toEqual(before);
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);

      await repo.deactivateUser(subject.id);
      await expect(repo.removeUser(subject.id)).rejects.toBeInstanceOf(
        AdminUserConflictError,
      );
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toMatchObject({ id: subject.id, isActive: false });
      expect(await readHistoryAndAnchors()).toEqual(before);
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);
    },
  );

  it("deletes only a reference-free user and leaves unrelated history intact", async () => {
    const before = await readHistoryAndAnchors();
    await repo.removeUser(subject.id);
    expect(
      await prisma.user.findUnique({ where: { id: subject.id } }),
    ).toBeNull();
    expect(
      await prisma.user.findUnique({ where: { id: unrelated.id } }),
    ).toEqual(unrelated);
    expect(await readHistoryAndAnchors()).toEqual(before);
  });

  it("migrates existing reopen decisions without changing live or absent authors and metadata", async () => {
    await addHistory("reopen-approved", subject.id);
    await addHistory("reopen-rejected", subject.id);
    await prisma.reopenRequest.create({
      data: {
        reportSectionId: data.section.id,
        requestedById: data.lead.id,
        status: "approved",
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
    assertTestDatabaseUrl(databaseUrl);
    const client = new pg.Client({ connectionString: databaseUrl });
    const migration = await readFile(
      new URL(
        "../../../../../prisma/migrations/20261013020000_reopen_reviewer_history_delete_restrict/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    try {
      await client.connect();
      // Fixtures commit before this connection acquires the DDL table lock.
      // Both the previous FK and the real, atomic migration stay rollback-only.
      await client.query("BEGIN");
      await client.query(`ALTER TABLE "ReopenRequest"
        DROP CONSTRAINT "ReopenRequest_reviewedById_fkey",
        ADD CONSTRAINT "ReopenRequest_reviewedById_fkey"
          FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE`);
      const before = await client.query(
        'SELECT * FROM "ReopenRequest" ORDER BY "id"',
      );
      await client.query(migration);
      const after = await client.query(
        'SELECT * FROM "ReopenRequest" ORDER BY "id"',
      );
      expect(after.rows).toEqual(before.rows);
      const foreignKey = await client.query<{
        action: string;
        validated: boolean;
      }>(`SELECT confdeltype AS action, convalidated AS validated
          FROM pg_constraint
          WHERE conrelid = '"ReopenRequest"'::regclass
            AND conname = 'ReopenRequest_reviewedById_fkey'`);
      expect(foreignKey.rows).toEqual([{ action: "r", validated: true }]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.end();
    }
  });

  it.each(HISTORY_KINDS)(
    "rejects the racing delete as a conflict when the %s reference commits first",
    async (kind) => {
      // An uncommitted reference INSERT holds FOR KEY SHARE on the user row,
      // so removeUser's delete waits on that transaction; once it commits the
      // RESTRICT FK refuses the delete and P2003 maps to the conflict error.
      const rowId = crypto.randomUUID();
      const reference = historyInsert(kind, rowId, subject.id);
      const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
      assertTestDatabaseUrl(databaseUrl);
      const referenceClient = new pg.Client({ connectionString: databaseUrl });
      const oracle = new pg.Client({ connectionString: databaseUrl });
      const observedPid = Promise.withResolvers<number>();
      let removal: Promise<void> | undefined;
      try {
        await Promise.all([referenceClient.connect(), oracle.connect()]);
        const referencePid = expectDefined(
          (
            await referenceClient.query<{ pid: number }>(
              "SELECT pg_backend_pid()::int AS pid",
            )
          ).rows[0],
        ).pid;
        await referenceClient.query("BEGIN");
        await referenceClient.query(reference.text, reference.values);

        const observedRepo = new AdminPrismaRepository(
          observeTransactionBackend(prisma, observedPid),
        );
        removal = observedRepo.removeUser(subject.id);
        void removal.catch(() => undefined);
        const waitingPid = await within(
          observedPid.promise,
          LOCK_WAIT_TIMEOUT_MS,
          "removeUser backend observation",
        );
        await waitForLockWaiter(oracle, waitingPid, referencePid);
        await referenceClient.query("COMMIT");
        await expect(
          within(removal, LOCK_WAIT_TIMEOUT_MS, "removeUser settlement"),
        ).rejects.toBeInstanceOf(AdminUserConflictError);
        await expect(removal).rejects.toThrow(
          "User is referenced by existing records; deactivate the user instead.",
        );
      } finally {
        await referenceClient.query("ROLLBACK").catch(() => undefined);
        if (removal !== undefined) {
          await within(
            removal,
            LOCK_WAIT_TIMEOUT_MS,
            "removeUser cleanup settlement",
          ).catch(() => undefined);
        }
        await Promise.allSettled([referenceClient.end(), oracle.end()]);
      }
      // User and the just-committed reference both survive; nothing else moved.
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toEqual(subject);
      expect(await historyRow(kind, rowId)).not.toBeNull();
      for (const other of HISTORY_KINDS) {
        expect(await historyCount(other)).toBe(other === kind ? 2 : 1);
      }
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);
    },
    30_000,
  );

  it.each(HISTORY_KINDS)(
    "fails the racing %s reference with 23503 when the delete commits first",
    async (kind) => {
      // The DELETE holds the user row, so the reference insert's FOR KEY SHARE
      // check waits on it; committing the delete leaves the FK unsatisfied.
      const rowId = crypto.randomUUID();
      const reference = historyInsert(kind, rowId, subject.id);
      const before = await readHistoryAndAnchors();
      const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
      assertTestDatabaseUrl(databaseUrl);
      const removal = new pg.Client({ connectionString: databaseUrl });
      const referencer = new pg.Client({ connectionString: databaseUrl });
      const oracle = new pg.Client({ connectionString: databaseUrl });
      let insertion: Promise<unknown> | undefined;
      try {
        await Promise.all([
          removal.connect(),
          referencer.connect(),
          oracle.connect(),
        ]);
        const removalPid = expectDefined(
          (
            await removal.query<{ pid: number }>(
              "SELECT pg_backend_pid()::int AS pid",
            )
          ).rows[0],
        ).pid;
        await removal.query("BEGIN");
        // Mirrors removeUser's statement so the held lock is the same one the
        // production delete takes before the RESTRICT FK arbitrates the race.
        await removal.query('DELETE FROM "User" WHERE "id" = $1', [subject.id]);
        const referencerPid = expectDefined(
          (
            await referencer.query<{ pid: number }>(
              "SELECT pg_backend_pid()::int AS pid",
            )
          ).rows[0],
        ).pid;
        insertion = referencer.query(reference.text, reference.values);
        void insertion.catch(() => undefined);
        await waitForLockWaiter(oracle, referencerPid, removalPid);
        await removal.query("COMMIT");
        await expect(
          within(
            insertion,
            LOCK_WAIT_TIMEOUT_MS,
            "reference insert settlement",
          ),
        ).rejects.toMatchObject({
          code: "23503",
          constraint: reference.constraint,
        });
      } finally {
        await removal.query("ROLLBACK").catch(() => undefined);
        await (insertion ?? Promise.resolve()).then(
          () => undefined,
          () => undefined,
        );
        await referencer.query("ROLLBACK").catch(() => undefined);
        await Promise.allSettled([
          removal.end(),
          referencer.end(),
          oracle.end(),
        ]);
      }
      // The delete won the arbitration: the raced reference never landed and
      // every unrelated row survived untouched.
      expect(
        await prisma.user.findUnique({ where: { id: subject.id } }),
      ).toBeNull();
      expect(await historyRow(kind, rowId)).toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: unrelated.id } }),
      ).toEqual(unrelated);
      expect(await readHistoryAndAnchors()).toEqual(before);
    },
    30_000,
  );
});
