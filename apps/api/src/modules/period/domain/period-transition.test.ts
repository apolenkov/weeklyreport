import { describe, expect, it } from "vitest";

import { buildTransition } from "./period-transition.js";

// Asserts the exact object each transition produces (toEqual) so a gained
// or dropped governed field fails the suite. See openspec/specs/period-dual-state.

const NOW = new Date("2026-05-29T12:00:00.000Z");

const DRAFT_LIFECYCLE = {
  status: "draft",
  archived: false,
  periodStatus: "open",
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} as const;

describe("buildTransition — create", () => {
  it("periodStart in the past → open (companion draft/false fields)", () => {
    expect(
      buildTransition("create", {
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        now: NOW,
      }),
    ).toEqual({ ...DRAFT_LIFECYCLE, periodState: "open" });
  });

  it("periodStart in the future → scheduled (companion draft/false fields)", () => {
    expect(
      buildTransition("create", {
        periodStart: new Date("2026-06-15T00:00:00.000Z"),
        now: NOW,
      }),
    ).toEqual({ ...DRAFT_LIFECYCLE, periodState: "scheduled" });
  });

  it("periodStart === now → open (boundary)", () => {
    expect(buildTransition("create", { periodStart: NOW, now: NOW })).toEqual({
      periodState: "open",
      ...DRAFT_LIFECYCLE,
    });
  });
});

describe("buildTransition — schedule / open", () => {
  it("schedule writes the scheduled state with the draft/false companion fields", () => {
    expect(buildTransition("schedule", {})).toEqual({
      periodState: "scheduled",
      ...DRAFT_LIFECYCLE,
    });
  });

  it("open writes the open state with the draft/false companion fields", () => {
    expect(buildTransition("open", {})).toEqual({
      periodState: "open",
      ...DRAFT_LIFECYCLE,
    });
  });
});

describe("buildTransition — publish", () => {
  it("moves all three machines to published and stamps the publisher", () => {
    expect(buildTransition("publish", { now: NOW, userId: "user-1" })).toEqual({
      status: "published",
      periodStatus: "published",
      periodState: "published",
      publishedAt: NOW,
      publishedById: "user-1",
    });
  });
});

describe("buildTransition — autoPublish", () => {
  it("matches publish but flags autoPublished and a null publisher", () => {
    // autoPublish MUST write periodStatus='published' just like the manual path,
    // not leave it at the default 'open'.
    expect(buildTransition("autoPublish", { now: NOW })).toEqual({
      status: "published",
      periodStatus: "published",
      periodState: "published",
      publishedAt: NOW,
      publishedById: null,
      autoPublished: true,
    });
  });
});

describe("buildTransition — reopen (intentional asymmetry)", () => {
  it("periodState reverts to open while periodStatus carries 'reopened'", () => {
    // The reopen transition deliberately diverges: periodState='open' (editable
    // again) but periodStatus='reopened' so consumers can discriminate a reopen
    // from a fresh open. The companion status/archive fields stay current.
    expect(buildTransition("reopen", { now: NOW })).toEqual({
      periodStatus: "reopened",
      periodState: "open",
      reopenedAt: NOW,
    });
  });
});

describe("buildTransition — archive / autoArchive", () => {
  it("archive flips archived + periodState only", () => {
    expect(buildTransition("archive", {})).toEqual({
      archived: true,
      periodState: "archived",
    });
  });

  it("autoArchive adds the autoArchived audit flag", () => {
    expect(buildTransition("autoArchive", {})).toEqual({
      archived: true,
      periodState: "archived",
      autoArchived: true,
    });
  });
});

describe("buildTransition — unarchive", () => {
  it("clears archived and sets the caller-derived next state (published)", () => {
    expect(
      buildTransition("unarchive", { nextPeriodState: "published" }),
    ).toEqual({ archived: false, periodState: "published" });
  });

  it("clears archived and sets the caller-derived next state (open)", () => {
    expect(buildTransition("unarchive", { nextPeriodState: "open" })).toEqual({
      archived: false,
      periodState: "open",
    });
  });
});

describe("buildTransition — restore", () => {
  it("preserves one complete schema-validated lifecycle field set verbatim", () => {
    const lifecycle = {
      periodState: "open",
      status: "published",
      archived: false,
      periodStatus: "reopened",
      autoPublished: false,
      autoArchived: false,
      publishedAt: NOW,
      publishedById: "user-1",
      reopenedAt: NOW,
    } as const;

    expect(buildTransition("restore", { lifecycle })).toEqual(lifecycle);
  });
});
