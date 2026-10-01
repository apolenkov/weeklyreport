import type {
  PublishedReportSnapshot,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  buildPublishedReadModelFromSnapshot,
  buildSnapshotResult,
} from "./weekly-report-read-model.js";

const GROUP = "00000000-0000-4000-8000-000000000099";
const authorIds = Array.from(
  { length: 10 },
  (_, index) => `00000000-0000-4000-8000-0000000001${index}0`,
);

// Scoping itself is covered in report-sections; here it hands a group's view
// (no sections) back so only the progress denominator is under test.
vi.mock("../report-sections/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../report-sections/index.js")>()),
  requireScopedPublishedSnapshot: (snapshot: PublishedReportSnapshot) => ({
    ...snapshot,
    sections: [],
  }),
}));

const snapshot = {
  reportId: "00000000-0000-4000-8000-000000000002",
  periodStart: "2026-04-14T00:00:00.000Z",
  periodEnd: "2026-04-18T00:00:00.000Z",
  deadline: null,
  sections: authorIds.map((authorId, index) => ({
    authorId,
    status: index < 3 ? "submitted" : "draft",
  })),
} as unknown as PublishedReportSnapshot;

const metadata = {
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: "Week 16",
} as const;

function progressFor(role: UserSession["role"]) {
  const session = {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "x@example.test",
    name: "X",
    role,
    reportingGroupId: GROUP,
  } as UserSession;
  const { readModel } = buildSnapshotResult(
    metadata as never,
    snapshot,
    session,
  );
  return [readModel.submissionCount, readModel.totalLeads];
}

describe("buildSnapshotResult progress", () => {
  it("counts the full snapshot for head and admin", () => {
    expect(progressFor("head")).toEqual([3, 10]);
    expect(progressFor("admin")).toEqual([3, 10]);
  });

  it("counts only the scoped snapshot for a lead", () => {
    expect(progressFor("lead")).toEqual([0, 0]);
  });
});

describe("buildPublishedReadModelFromSnapshot orgProgress", () => {
  it("prefers the org-wide progress frozen into a scoped PDF snapshot", () => {
    const scoped = {
      ...snapshot,
      sections: [],
      orgProgress: { submitted: 9, total: 9 },
    } as unknown as PublishedReportSnapshot;
    const model = buildPublishedReadModelFromSnapshot(scoped, metadata);
    expect([model.submissionCount, model.totalLeads]).toEqual([9, 9]);
  });
});
