import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  currentPeriodLifecycleSchema,
  decodeLegacyReportPeriod,
  LegacyPeriodIncompatibilityError,
} from "./period-lifecycle.schema";

const PUBLISHED_AT = new Date("2026-07-24T18:00:00.000Z");
const REOPENED_AT = new Date("2026-07-25T09:00:00.000Z");

const baseLifecycle = {
  status: "draft" as const,
  periodState: "open" as const,
  periodStatus: "open" as const,
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

const validCoreTuples = [
  ["scheduled", "draft", false, "open"],
  ["open", "draft", false, "open"],
  ["open", "published", false, "reopened"],
  ["published", "published", false, "published"],
  ["archived", "draft", true, "open"],
  ["archived", "published", true, "published"],
] as const;

const allCoreTuples = ["scheduled", "open", "published", "archived"].flatMap(
  (periodState) =>
    ["draft", "published"].flatMap((status) =>
      [false, true].flatMap((archived) =>
        ["open", "published", "reopened"].map((periodStatus) => ({
          periodState,
          status,
          archived,
          periodStatus,
        })),
      ),
    ),
);

const validTupleKeys = new Set(
  validCoreTuples.map((tuple) => tuple.map(String).join("|")),
);

const contradictoryCoreTuples = allCoreTuples.filter(
  ({ periodState, status, archived, periodStatus }) =>
    !validTupleKeys.has(
      [periodState, status, archived, periodStatus].map(String).join("|"),
    ),
);

function lifecycleForTuple(
  periodState: string,
  status: string,
  archived: boolean,
  periodStatus: string,
) {
  const published = status === "published";
  const reopened = periodStatus === "reopened";
  return {
    ...baseLifecycle,
    periodState,
    status,
    archived,
    periodStatus,
    publishedAt: published ? PUBLISHED_AT : null,
    publishedById: published ? randomUUID() : null,
    reopenedAt: reopened ? REOPENED_AT : null,
  };
}

describe("currentPeriodLifecycleSchema", () => {
  it("covers all 42 contradictory core tuples", () => {
    expect(contradictoryCoreTuples).toHaveLength(42);
  });

  it.each(validCoreTuples)(
    "accepts %s/%s/archived=%s/%s",
    (periodState, status, archived, periodStatus) => {
      expect(
        currentPeriodLifecycleSchema.safeParse(
          lifecycleForTuple(periodState, status, archived, periodStatus),
        ).success,
      ).toBe(true);
    },
  );

  it.each(contradictoryCoreTuples)(
    "rejects contradictory tuple $periodState/$status/archived=$archived/$periodStatus",
    ({ periodState, status, archived, periodStatus }) => {
      expect(
        currentPeriodLifecycleSchema.safeParse(
          lifecycleForTuple(periodState, status, archived, periodStatus),
        ).success,
      ).toBe(false);
    },
  );

  it.each(Object.keys(baseLifecycle))("rejects omitted %s", (field) => {
    const input = Object.fromEntries(
      Object.entries(baseLifecycle).filter(([key]) => key !== field),
    );
    expect(currentPeriodLifecycleSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["publishedAt", PUBLISHED_AT],
    ["publishedById", randomUUID()],
    ["reopenedAt", REOPENED_AT],
    ["autoPublished", true],
    ["autoArchived", true],
  ] as const)("rejects draft periods carrying %s", (field, value) => {
    expect(
      currentPeriodLifecycleSchema.safeParse({
        ...baseLifecycle,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it("requires reopenedAt for the reopened tuple", () => {
    expect(
      currentPeriodLifecycleSchema.safeParse({
        ...lifecycleForTuple("open", "published", false, "reopened"),
        reopenedAt: null,
      }).success,
    ).toBe(false);
  });
});

const legacyPeriod = {
  id: "11111111-1111-4111-8111-111111111111",
  periodStart: "2026-07-20T00:00:00.000Z",
  periodEnd: "2026-07-26T23:59:59.999Z",
  deadline: null,
  status: "draft" as const,
};

describe("decodeLegacyReportPeriod", () => {
  it.each([
    ["draft", false, "open", "open"],
    ["draft", true, "archived", "open"],
    ["published", false, "published", "published"],
    ["published", true, "archived", "published"],
  ] as const)(
    "normalizes v1 %s/archived=%s to %s/%s",
    (status, archived, periodState, periodStatus) => {
      const decoded = decodeLegacyReportPeriod({
        version: 1,
        period: { ...legacyPeriod, status, archived },
      });

      expect(decoded).toMatchObject({
        status,
        archived,
        periodState,
        periodStatus,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      });
      expect(currentPeriodLifecycleSchema.safeParse(decoded).success).toBe(
        true,
      );
    },
  );

  it("rejects an unsupported version with a typed reason", () => {
    expect(() =>
      decodeLegacyReportPeriod({ version: 2, period: legacyPeriod }),
    ).toThrow(
      expect.objectContaining<Partial<LegacyPeriodIncompatibilityError>>({
        reason: "unsupported-version",
      }),
    );
  });

  it("rejects unversioned input", () => {
    expect(() => decodeLegacyReportPeriod(legacyPeriod)).toThrow(
      LegacyPeriodIncompatibilityError,
    );
  });

  it("rejects a mixed-generation v1 payload", () => {
    expect(() =>
      decodeLegacyReportPeriod({
        version: 1,
        period: { ...legacyPeriod, periodState: "open" },
      }),
    ).toThrow(
      expect.objectContaining<Partial<LegacyPeriodIncompatibilityError>>({
        reason: "invalid-payload",
      }),
    );
  });
});
