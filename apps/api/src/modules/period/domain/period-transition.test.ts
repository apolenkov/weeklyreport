import { expect, it } from "vitest";

import { buildTransition } from "./period-transition.js";

// Tests are flat (no describe): Stryker 10 builds its test-name filter by
// joining suite names with a space, while Vitest 5 matches `a > b`, so a nested
// title would never be selected and every mutant would survive.
// TODO(TASK-522): upstream stryker-js fix, or coverageAnalysis "all", before
// the mutation inventory expands to suites that use describe.
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

it("buildTransition — create periodStart in the past → open (companion draft/false fields)", () => {
  expect(
    buildTransition("create", {
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      now: NOW,
    }),
  ).toEqual({ ...DRAFT_LIFECYCLE, periodState: "open" });
});

it("buildTransition — create periodStart in the future → scheduled (companion draft/false fields)", () => {
  expect(
    buildTransition("create", {
      periodStart: new Date("2026-06-15T00:00:00.000Z"),
      now: NOW,
    }),
  ).toEqual({ ...DRAFT_LIFECYCLE, periodState: "scheduled" });
});

it("buildTransition — create periodStart === now → open (boundary)", () => {
  expect(buildTransition("create", { periodStart: NOW, now: NOW })).toEqual({
    periodState: "open",
    ...DRAFT_LIFECYCLE,
  });
});

it("buildTransition — schedule / open schedule writes the scheduled state with the draft/false companion fields", () => {
  expect(buildTransition("schedule", {})).toEqual({
    periodState: "scheduled",
    ...DRAFT_LIFECYCLE,
  });
});

it("buildTransition — schedule / open open writes the open state with the draft/false companion fields", () => {
  expect(buildTransition("open", {})).toEqual({
    periodState: "open",
    ...DRAFT_LIFECYCLE,
  });
});

it("buildTransition — publish moves all three machines to published and stamps the publisher", () => {
  expect(buildTransition("publish", { now: NOW, userId: "user-1" })).toEqual({
    status: "published",
    periodStatus: "published",
    periodState: "published",
    autoPublished: false,
    publishedAt: NOW,
    publishedById: "user-1",
  });
});

it("buildTransition — autoPublish matches publish but flags autoPublished and a null publisher", () => {
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

it("buildTransition — reopen (intentional asymmetry) periodState reverts to open while periodStatus carries 'reopened'", () => {
  // The reopen transition deliberately diverges: periodState='open' (editable
  // again) but periodStatus='reopened' so consumers can discriminate a reopen
  // from a fresh open. The ended publication's audit flag is cleared, so the
  // reopened row never claims an automatic publication it no longer has.
  expect(buildTransition("reopen", { now: NOW })).toEqual({
    periodStatus: "reopened",
    periodState: "open",
    autoPublished: false,
    reopenedAt: NOW,
  });
});

it("buildTransition — archive / autoArchive archive flips archived + periodState and records manual provenance", () => {
  expect(buildTransition("archive", {})).toEqual({
    archived: true,
    periodState: "archived",
    autoArchived: false,
  });
});

it("buildTransition — archive / autoArchive autoArchive adds the autoArchived audit flag", () => {
  expect(buildTransition("autoArchive", {})).toEqual({
    archived: true,
    periodState: "archived",
    autoArchived: true,
  });
});

it("buildTransition — unarchive clears archived and the auto-archive flag (published)", () => {
  expect(
    buildTransition("unarchive", { nextPeriodState: "published" }),
  ).toEqual({
    archived: false,
    periodState: "published",
    autoArchived: false,
  });
});

it("buildTransition — unarchive clears archived and the auto-archive flag (open)", () => {
  expect(buildTransition("unarchive", { nextPeriodState: "open" })).toEqual({
    archived: false,
    periodState: "open",
    autoArchived: false,
  });
});

it("buildTransition — restore preserves one complete schema-validated lifecycle field set verbatim", () => {
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
