import type {
  AdminReminderExecution,
  PaginationInput,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { unusedRemindersRepositoryStubs } from "./__tests__/reminders-scope.repository-stub.js";
import { RemindersService } from "./reminders.service.js";
import type { RemindersRepository } from "./reminders.types.js";

// Recipient-level scope on `listExecutions` MUST run over the full slice BEFORE
// cursor pagination: filtering the already-paginated page would let out-of-scope
// rows consume the page size and surface an out-of-scope id as `nextCursor`.

const RULE_ID = "a0000000-0000-4000-a000-0000000000a1";
const REPORT_ID = "a0000000-0000-4000-a000-0000000000a2";
const IN_SCOPE = "lead-a@test.local";
const OUT_OF_SCOPE = "lead-b@test.local";

function execution(
  idTail: string,
  recipientEmail: string,
): AdminReminderExecution {
  return {
    id: `a0000000-0000-4000-a000-0000000${idTail}`,
    ruleId: RULE_ID,
    reportId: REPORT_ID,
    dedupeKey: `${RULE_ID}:deadline:2026-04-11:${recipientEmail}`,
    status: "queued",
    scheduledFor: new Date("2026-04-11T09:00:00.000Z"),
    sentAt: null,
    recipientEmail,
    errorMessage: null,
  };
}

// Newest-first slice as the repository returns it: two out-of-scope rows lead
// the slice, so a late filter would empty the first page and leak B2 as cursor.
const B1 = execution("000b1", OUT_OF_SCOPE);
const B2 = execution("000b2", OUT_OF_SCOPE);
const A1 = execution("000a1", IN_SCOPE);
const A2 = execution("000a2", IN_SCOPE);
const A3 = execution("000a3", IN_SCOPE);

function buildService(
  rows: readonly AdminReminderExecution[],
): RemindersService {
  // Emulates the port's keyset contract: the page starts strictly after
  // `cursor` and carries at most `take` rows.
  const repository = {
    ...unusedRemindersRepositoryStubs(),
    listExecutions: vi.fn(
      (_ruleId: string, page: { cursor: string | null; take: number }) => {
        const start = page.cursor
          ? rows.findIndex((row) => row.id === page.cursor) + 1
          : 0;
        return Promise.resolve(rows.slice(start, start + page.take));
      },
    ),
  } satisfies RemindersRepository;
  return new RemindersService(repository, createNullLogger());
}

describe("RemindersService.listExecutions — recipient scope before pagination", () => {
  const allowlist = new Set([IN_SCOPE]);
  const firstPage: PaginationInput = { limit: 2 };

  it("paginates the scoped set, not the raw slice (page contents + nextCursor)", async () => {
    const service = buildService([B1, B2, A1, A2, A3]);

    const result = await service.listExecutions(RULE_ID, firstPage, allowlist);

    expect(result.items.map((e) => e.id)).toEqual([A1.id, A2.id]);
    expect(result.items.every((e) => e.recipientEmail === IN_SCOPE)).toBe(true);
    // nextCursor is the last IN-SCOPE id of the page, never a leaked B id.
    expect(result.nextCursor).toBe(A2.id);
  });

  it("walks the cursor across the scoped set to a terminal null", async () => {
    const service = buildService([B1, B2, A1, A2, A3]);

    const second = await service.listExecutions(
      RULE_ID,
      { limit: 2, cursor: A2.id },
      allowlist,
    );

    expect(second.items.map((e) => e.id)).toEqual([A3.id]);
    expect(second.nextCursor).toBeNull();
  });

  it("drops out-of-scope rows even when unpaginated", async () => {
    const service = buildService([B1, A1, B2]);

    const result = await service.listExecutions(RULE_ID, undefined, allowlist);

    expect(result.items.map((e) => e.id)).toEqual([A1.id]);
    expect(result.nextCursor).toBeNull();
  });

  it("admin (null allowlist) sees the unfiltered set", async () => {
    const service = buildService([B1, A1, B2]);

    const result = await service.listExecutions(RULE_ID, undefined, null);

    expect(result.items).toHaveLength(3);
    expect(expectDefined(result.items[0]).recipientEmail).toBe(OUT_OF_SCOPE);
  });

  it("fails loud when an unpaginated read exceeds the hard cap", async () => {
    const tooMany = Array.from({ length: 1001 }, (_, index) =>
      execution(index.toString(16).padStart(5, "0"), IN_SCOPE),
    );
    const service = buildService(tooMany);

    await expect(
      service.listExecutions(RULE_ID, undefined, new Set([IN_SCOPE])),
    ).rejects.toThrow(/exceeds the unpaginated cap/);
  });
});
