import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  periodListBucketSchema,
  periodListItemSchema,
  periodStateSchema,
  periodStatusSchema,
  reportPeriodSchema,
  stageAssignmentSchema,
  stageSchema,
} from "./report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();
// ---------------------------------------------------------------------------
// draftSaveSchema boundaries
// ---------------------------------------------------------------------------

describe("periodStatusSchema", () => {
  it('accepts "open"', () => {
    expect(periodStatusSchema.safeParse("open").success).toBe(true);
  });

  it('accepts "published"', () => {
    expect(periodStatusSchema.safeParse("published").success).toBe(true);
  });

  it('accepts "reopened"', () => {
    expect(periodStatusSchema.safeParse("reopened").success).toBe(true);
  });

  it('rejects unknown value "closed"', () => {
    expect(periodStatusSchema.safeParse("closed").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(periodStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects null", () => {
    expect(periodStatusSchema.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// periodStateSchema
// ---------------------------------------------------------------------------

describe("periodStateSchema", () => {
  it('accepts "scheduled"', () => {
    expect(periodStateSchema.safeParse("scheduled").success).toBe(true);
  });

  it('accepts "open"', () => {
    expect(periodStateSchema.safeParse("open").success).toBe(true);
  });

  it('accepts "published"', () => {
    expect(periodStateSchema.safeParse("published").success).toBe(true);
  });

  it('accepts "archived"', () => {
    expect(periodStateSchema.safeParse("archived").success).toBe(true);
  });

  it('rejects "reopened" (lives on periodStatusSchema, not periodStateSchema)', () => {
    expect(periodStateSchema.safeParse("reopened").success).toBe(false);
  });

  it("rejects unknown value", () => {
    expect(periodStateSchema.safeParse("closed").success).toBe(false);
  });

  it("rejects screaming-snake casing", () => {
    expect(periodStateSchema.safeParse("OPEN").success).toBe(false);
  });

  it("reportPeriodSchema: periodState is optional (back-compat)", () => {
    const parsed = reportPeriodSchema.safeParse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "draft",
    });
    expect(parsed.success).toBe(true);
  });

  it("reportPeriodSchema: periodState carries through when supplied", () => {
    const parsed = reportPeriodSchema.parse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "draft",
      periodState: "open",
    });
    expect(parsed.periodState).toBe("open");
  });

  it("reportPeriodSchema: the full governed lifecycle set is optional (back-compat)", () => {
    // A legacy snapshot (only the date envelope + status) must still parse so
    // old admin exports restore.
    const parsed = reportPeriodSchema.safeParse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "published",
    });
    expect(parsed.success).toBe(true);
  });

  it("reportPeriodSchema: the full governed lifecycle set carries through", () => {
    // A reopened period keeps three distinct values; the schema must
    // round-trip them verbatim.
    const parsed = reportPeriodSchema.parse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "published",
      periodState: "open",
      periodStatus: "reopened",
      archived: false,
      autoPublished: true,
      autoArchived: false,
      publishedAt: "2026-05-16T10:00:00.000Z",
      publishedById: randomUUID(),
      reopenedAt: "2026-05-18T09:00:00.000Z",
    });
    expect(parsed.periodState).toBe("open");
    expect(parsed.periodStatus).toBe("reopened");
    expect(parsed.status).toBe("published");
    expect(parsed.autoPublished).toBe(true);
    expect(parsed.publishedAt).toBeInstanceOf(Date);
    expect(parsed.reopenedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// periodListBucketSchema + periodListItemSchema
// ---------------------------------------------------------------------------

describe("periodListBucketSchema", () => {
  it.each(["active", "archive", "scheduled", "open", "published", "archived"])(
    "accepts %s",
    (bucket) => {
      expect(periodListBucketSchema.safeParse(bucket).success).toBe(true);
    },
  );

  it('rejects "reopened" (not a state, lives on periodStatus)', () => {
    expect(periodListBucketSchema.safeParse("reopened").success).toBe(false);
  });

  it("rejects unknown bucket", () => {
    expect(periodListBucketSchema.safeParse("all").success).toBe(false);
  });
});

describe("periodListItemSchema", () => {
  const baseRow = {
    id: randomUUID(),
    periodStart: "2026-05-11",
    periodEnd: "2026-05-17",
    deadline: "2026-05-15",
    publishedAt: null,
    periodState: "open" as const,
    periodStatus: "open" as const,
    archived: false,
    autoPublished: false,
    autoArchived: false,
    submittedCount: 3,
    totalCount: 6,
    canReopen: false,
    canArchive: false,
  };

  it("accepts a minimally-valid active row", () => {
    expect(periodListItemSchema.safeParse(baseRow).success).toBe(true);
  });

  it("coerces publishedAt from ISO string to Date", () => {
    const parsed = periodListItemSchema.parse({
      ...baseRow,
      periodState: "published",
      periodStatus: "published",
      publishedAt: "2026-05-15T10:00:00Z",
      canReopen: true,
      canArchive: true,
    });
    expect(parsed.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects negative submittedCount", () => {
    const parsed = periodListItemSchema.safeParse({
      ...baseRow,
      submittedCount: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects "reopened" on periodState (but accepts on periodStatus)', () => {
    expect(
      periodListItemSchema.safeParse({ ...baseRow, periodState: "reopened" })
        .success,
    ).toBe(false);
    expect(
      periodListItemSchema.safeParse({ ...baseRow, periodStatus: "reopened" })
        .success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stageSchema
// ---------------------------------------------------------------------------

describe("stageSchema", () => {
  it("accepts valid stage", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Development",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Testing",
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Testing",
      sortOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const result = stageSchema.safeParse({
      id: "not-a-uuid",
      name: "Dev",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stageAssignmentSchema
// ---------------------------------------------------------------------------

describe("stageAssignmentSchema", () => {
  it("accepts valid assignment with all fields", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Development",
      userName: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("accepts assignment without optional userName", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Testing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty stageName", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID userId", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: "not-uuid",
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Dev",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      stageName: "Dev",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appSettingsSchema
// ---------------------------------------------------------------------------
