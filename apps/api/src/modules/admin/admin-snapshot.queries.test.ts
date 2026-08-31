import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { getSnapshot } from "./admin-snapshot.queries.js";

const EXECUTION_CREATED_AT = new Date("2026-04-07T09:00:00.000Z");
const EXECUTION_UPDATED_AT = new Date("2026-04-07T09:30:00.000Z");
const RULE_FIRE_AT = new Date("2026-04-10T09:00:00.000Z");
const REPORT_ID = "e0000000-0000-4000-8000-000000000003";
const RULE_ID = "e0000000-0000-4000-8000-000000000002";
const POLICY_ID = "e0000000-0000-4000-8000-000000000004";
const RECIPIENT_EMAIL = "lead@test.local";
const QUEUE_PAYLOAD = {
  contractVersion: 1,
  kind: "deadline",
  cycleDate: "2026-04-10",
  leadName: "Test Lead",
  reportPeriod: "2026-04-06 → 2026-04-12",
  deadlineIso: RULE_FIRE_AT.toISOString(),
  sectionUrl: `https://example.test/lead/report/${REPORT_ID}`,
  organization: {
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  },
};

interface SnapshotFixtureOverrides {
  readonly reportDeadline?: Date;
  readonly report?: Readonly<Record<string, unknown>>;
  readonly reminderRules?: readonly Record<string, unknown>[];
  readonly reminderPolicies?: readonly Record<string, unknown>[];
}

function prismaWith(
  execution: unknown,
  overrides: SnapshotFixtureOverrides = {},
): PrismaService {
  const reportDeadline = overrides.reportDeadline ?? RULE_FIRE_AT;
  const transactionClient = {
    reportingGroup: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    report: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: REPORT_ID,
          periodStart: new Date("2026-04-06T00:00:00.000Z"),
          periodEnd: new Date("2026-04-12T23:59:59.999Z"),
          deadline: reportDeadline,
          weekLabel: "Apr 6–12",
          status: "draft",
          periodState: "open",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
          publishedSnapshot: null,
          ...overrides.report,
        },
      ]),
    },
    reminderRule: {
      findMany: vi.fn().mockResolvedValue(
        overrides.reminderRules ?? [
          {
            id: RULE_ID,
            reportId: REPORT_ID,
            policyId: POLICY_ID,
            kind: "deadline",
            fireAt: RULE_FIRE_AT,
            deadline: RULE_FIRE_AT,
            timezone: "Europe/Moscow",
            status: "active",
            version: 1,
          },
        ],
      ),
    },
    reminderExecution: { findMany: vi.fn().mockResolvedValue([execution]) },
    reminderPolicy: {
      findMany: vi.fn().mockResolvedValue(
        overrides.reminderPolicies ?? [
          {
            id: POLICY_ID,
            kind: "deadline",
            offsetMinutes: 0,
            timezone: "Europe/Moscow",
            audience: "LEAD_WITH_DRAFT",
            active: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: null,
          },
        ],
      ),
    },
  };
  return {
    ...transactionClient,
    $transaction: vi.fn(
      (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
    ),
  } as unknown as PrismaService;
}

// Recovery snapshots preserve the owning rule's reportId and fireAt facts;
// execution timestamps must not replace either value.
describe("getSnapshot — reminder execution facts", () => {
  it("maps reportId and scheduledFor from the owning rule, never createdAt", async () => {
    const prisma = prismaWith({
      id: "e0000000-0000-4000-8000-000000000001",
      ruleId: RULE_ID,
      dedupeKey: `${RULE_ID}:deadline:2026-04-10:${RECIPIENT_EMAIL}`,
      status: "pending",
      sentAt: null,
      recipientEmail: RECIPIENT_EMAIL,
      error: null,
      queuePayload: QUEUE_PAYLOAD,
      createdAt: EXECUTION_CREATED_AT,
      updatedAt: EXECUTION_UPDATED_AT,
      rule: {
        reportId: REPORT_ID,
        fireAt: RULE_FIRE_AT,
      },
    });

    const snapshot = await getSnapshot(prisma);

    expect(snapshot.reminderExecutions[0]).toMatchObject({
      reportId: REPORT_ID,
      scheduledFor: RULE_FIRE_AT,
      queuePayload: QUEUE_PAYLOAD,
      createdAt: EXECUTION_CREATED_AT,
      updatedAt: EXECUTION_UPDATED_AT,
    });
    expect(snapshot.reminderExecutions[0]?.scheduledFor).not.toEqual(
      EXECUTION_CREATED_AT,
    );
    expect(snapshot.periods[0]?.weekLabel).toBe("Apr 6–12");
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });

  it("exports a sent execution against its immutable historical rule after schedule edits", async () => {
    const currentDeadline = new Date("2026-04-17T11:00:00.000Z");
    const currentRuleId = "e0000000-0000-4000-8000-000000000005";
    const execution = {
      id: "e0000000-0000-4000-8000-000000000001",
      ruleId: RULE_ID,
      dedupeKey: `${RULE_ID}:deadline:2026-04-10:${RECIPIENT_EMAIL}`,
      status: "sent",
      sentAt: new Date("2026-04-10T09:01:00.000Z"),
      recipientEmail: RECIPIENT_EMAIL,
      error: null,
      queuePayload: QUEUE_PAYLOAD,
      createdAt: EXECUTION_CREATED_AT,
      updatedAt: EXECUTION_UPDATED_AT,
      rule: { reportId: REPORT_ID, fireAt: RULE_FIRE_AT },
    };
    const snapshot = await getSnapshot(
      prismaWith(execution, {
        reportDeadline: currentDeadline,
        reminderRules: [
          {
            id: RULE_ID,
            reportId: REPORT_ID,
            policyId: POLICY_ID,
            kind: "deadline",
            fireAt: RULE_FIRE_AT,
            deadline: RULE_FIRE_AT,
            timezone: "Europe/Moscow",
            status: "paused",
            version: 1,
          },
          {
            id: currentRuleId,
            reportId: REPORT_ID,
            policyId: POLICY_ID,
            kind: "escalation",
            fireAt: currentDeadline,
            deadline: currentDeadline,
            timezone: "Europe/Moscow",
            status: "active",
            version: 2,
          },
        ],
        reminderPolicies: [
          {
            id: POLICY_ID,
            kind: "escalation",
            offsetMinutes: 0,
            timezone: "Europe/Moscow",
            audience: "HEAD_OF_LATE",
            active: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: null,
          },
        ],
      }),
    );

    expect(snapshot.reminderExecutions[0]).toMatchObject({
      ruleId: RULE_ID,
      status: "sent",
      scheduledFor: RULE_FIRE_AT,
      queuePayload: QUEUE_PAYLOAD,
    });
    expect(snapshot.reminderRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: RULE_ID,
          deadline: RULE_FIRE_AT,
          status: "paused",
          version: 1,
        }),
        expect.objectContaining({
          id: currentRuleId,
          deadline: currentDeadline,
          status: "active",
          version: 2,
        }),
      ]),
    );
  });

  it.each([
    ["manually", false],
    ["automatically", true],
  ] as const)(
    "exports a %s archived report only after its reminder rule is paused",
    async (_archiveMode, autoArchived) => {
      const report = autoArchived
        ? {
            status: "published",
            periodState: "archived",
            periodStatus: "published",
            archived: true,
            autoArchived: true,
            publishedAt: new Date("2026-04-12T18:00:00.000Z"),
            publishedSnapshot: {
              reportId: REPORT_ID,
              periodStart: "2026-04-06T00:00:00.000Z",
              periodEnd: "2026-04-12T23:59:59.999Z",
              deadline: RULE_FIRE_AT.toISOString(),
              status: "published",
              publishedAt: "2026-04-12T18:00:00.000Z",
              publishedById: null,
              publishedByName: null,
              portfolioOverview: {
                status: "green",
                totals: { green: 0, yellow: 0, red: 0 },
              },
              sections: [],
            },
          }
        : {
            periodState: "archived",
            periodStatus: "open",
            archived: true,
            autoArchived: false,
          };
      const snapshot = await getSnapshot(
        prismaWith(
          {
            id: "e0000000-0000-4000-8000-000000000001",
            ruleId: RULE_ID,
            dedupeKey: `${RULE_ID}:deadline:2026-04-10:${RECIPIENT_EMAIL}`,
            status: "sent",
            sentAt: new Date("2026-04-10T09:01:00.000Z"),
            recipientEmail: RECIPIENT_EMAIL,
            error: null,
            queuePayload: QUEUE_PAYLOAD,
            createdAt: EXECUTION_CREATED_AT,
            updatedAt: EXECUTION_UPDATED_AT,
            rule: { reportId: REPORT_ID, fireAt: RULE_FIRE_AT },
          },
          {
            report,
            reminderRules: [
              {
                id: RULE_ID,
                reportId: REPORT_ID,
                policyId: POLICY_ID,
                kind: "deadline",
                fireAt: RULE_FIRE_AT,
                deadline: RULE_FIRE_AT,
                timezone: "Europe/Moscow",
                status: "paused",
                version: 1,
              },
            ],
          },
        ),
      );

      expect(snapshot.periods[0]).toMatchObject({
        periodState: "archived",
        archived: true,
        autoArchived,
      });
      expect(snapshot.reminderRules[0]).toMatchObject({ status: "paused" });
    },
  );
});
