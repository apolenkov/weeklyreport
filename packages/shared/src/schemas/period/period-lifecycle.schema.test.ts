import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { currentPeriodLifecycleSchema } from "./period-lifecycle.schema";

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
  it("covers all 42 contradictory core combinations", () => {
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
    "rejects contradictory lifecycle combination $periodState/$status/archived=$archived/$periodStatus",
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

  it("requires reopenedAt for the reopened lifecycle combination", () => {
    expect(
      currentPeriodLifecycleSchema.safeParse({
        ...lifecycleForTuple("open", "published", false, "reopened"),
        reopenedAt: null,
      }).success,
    ).toBe(false);
  });

  it("requires publishedAt for every published lifecycle", () => {
    expect(
      currentPeriodLifecycleSchema.safeParse({
        ...lifecycleForTuple("published", "published", false, "published"),
        publishedAt: null,
      }).success,
    ).toBe(false);
  });
});
