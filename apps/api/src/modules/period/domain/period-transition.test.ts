import { describe, expect, it } from "vitest";

import { buildTransition } from "./period-transition.js";

// ---------------------------------------------------------------------------
// The pure builder is the single source of truth for the Report lifecycle
// field set. Each test asserts the EXACT object a transition produces
// (`toEqual`, not `toMatchObject`) so the suite fails if a transition gains
// or drops a governed field.
//
// Governed fields: periodState, the legacy (status, archived) tuple,
// periodStatus (reopen flavour), the autoPublished/autoArchived audit flags,
// and the publishedAt/publishedById/reopenedAt timestamps. Identity fields
// (periodStart/periodEnd/deadline/weekLabel) are NOT governed here.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-29T12:00:00.000Z");

describe("buildTransition — create", () => {
  it("periodStart in the past → open (legacy tuple draft/false)", () => {
    expect(
      buildTransition("create", {
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        now: NOW,
      }),
    ).toEqual({ periodState: "open", status: "draft", archived: false });
  });

  it("periodStart in the future → scheduled (legacy tuple draft/false)", () => {
    expect(
      buildTransition("create", {
        periodStart: new Date("2026-06-15T00:00:00.000Z"),
        now: NOW,
      }),
    ).toEqual({ periodState: "scheduled", status: "draft", archived: false });
  });

  it("periodStart === now → open (boundary)", () => {
    expect(buildTransition("create", { periodStart: NOW, now: NOW })).toEqual({
      periodState: "open",
      status: "draft",
      archived: false,
    });
  });
});

describe("buildTransition — schedule / open", () => {
  it("schedule writes the scheduled state with the draft/false tuple", () => {
    expect(buildTransition("schedule", {})).toEqual({
      periodState: "scheduled",
      status: "draft",
      archived: false,
    });
  });

  it("open writes the open state with the draft/false tuple", () => {
    expect(buildTransition("open", {})).toEqual({
      periodState: "open",
      status: "draft",
      archived: false,
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
    // Regression guard for the corrected motivating bug: the auto path used
    // to leave periodStatus at the default 'open' forever. autoPublish MUST
    // write periodStatus='published' just like the manual path.
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
    // The reopen flavour machine and the canonical state machine deliberately
    // disagree: periodState='open' (editable again) but periodStatus='reopened'
    // so consumers can still discriminate a reopen from a fresh open. The
    // legacy (status, archived) tuple is left untouched on reopen.
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
