import { describe, expect, it } from "vitest";

import { readStateManifest, stateEntryPaths } from "./states.ts";

const readBack = {
  version: 1,
  state: "returned",
  seedProfile: "full",
  target: { database: "customreport_e2e", host: "127.0.0.1", port: "55432" },
  targetUrl: "postgresql://***@127.0.0.1:55432/customreport_e2e",
  reportId: "a0000000-0000-4000-8000-000000000001",
  sectionId: "a0000000-0000-4000-8000-000000004011",
  authorId: "a0000000-0000-4000-8000-000000000011",
  preparedAt: "2026-10-04T18:00:00.000Z",
  observed: {
    periodState: "open",
    status: "draft",
    periodStatus: "open",
    archived: false,
    sectionStatus: "draft",
    sectionVersion: 1,
    hasPublishedSnapshot: false,
    reviewVerdict: "changes_requested",
    reviewComment: "Clarify the delivery date.",
  },
  specs: ["period-dual-state"],
} as const;

describe("crawl fixture evidence boundary", () => {
  it("accepts a returned draft receipt but rejects relabeling, wrong scope and missing reasons", () => {
    expect(() => readStateManifest(readBack, "returned")).not.toThrow();
    expect(() => readStateManifest(readBack, "submitted")).toThrow();
    expect(() =>
      readStateManifest({ ...readBack, state: "submitted" }),
    ).toThrow();
    expect(() =>
      readStateManifest({
        ...readBack,
        reportId: "a0000000-0000-4000-8000-000000000002",
      }),
    ).toThrow();
    expect(() =>
      readStateManifest({
        ...readBack,
        observed: { ...readBack.observed, reviewComment: " " },
      }),
    ).toThrow();
  });

  it.each([
    "postgresql://operator:secret@127.0.0.1:55432/customreport_e2e",
    "postgresql://***@127.0.0.1:55432/customreport_production",
    "postgresql://***@remote.example:55432/customreport_e2e",
    "postgresql://***@127.0.0.1:55433/customreport_e2e",
    "https://***@127.0.0.1:55432/customreport_e2e",
  ])("rejects an unmasked or mismatched evidence target: %s", (targetUrl) => {
    expect(() => readStateManifest({ ...readBack, targetUrl })).toThrow();
  });

  it("does not accept a declared publication without a snapshot", () => {
    expect(() =>
      readStateManifest({
        ...readBack,
        state: "published",
        observed: {
          ...readBack.observed,
          periodState: "published",
          status: "published",
          periodStatus: "published",
          sectionStatus: "submitted",
          reviewVerdict: null,
          reviewComment: null,
        },
      }),
    ).toThrow();
  });
});

describe("admin entry pages per state", () => {
  it("walks every tab once and only the lifecycle tabs in later states", () => {
    const all = stateEntryPaths("admin", "returned");
    expect(all).toContain("/admin?tab=users");
    expect(all).toContain("/pdf-exports");
    expect(stateEntryPaths("admin", "published", true)).toEqual([
      "/admin?tab=periods",
      "/admin?tab=reopen",
    ]);
  });
});
