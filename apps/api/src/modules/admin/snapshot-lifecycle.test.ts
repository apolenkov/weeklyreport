import type { ReportPeriod } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { resolveLifecycle } from "./snapshot-lifecycle.js";

// `resolveLifecycle` is the pure core of the admin snapshot restore.
// These tests pin the two paths that matter — verbatim
// reinstatement when the snapshot is full-fidelity (the reopened round-trip
// MUST NOT be flattened), and the legacy-tuple backfill when fields are absent.

const base = (): ReportPeriod => ({
  id: "11111111-1111-1111-1111-111111111111",
  periodStart: new Date("2026-05-11T00:00:00.000Z"),
  periodEnd: new Date("2026-05-17T00:00:00.000Z"),
  deadline: new Date("2026-05-15T00:00:00.000Z"),
  status: "draft",
});

describe("resolveLifecycle — full-fidelity (present values are verbatim)", () => {
  it("round-trips a published period with every field intact", () => {
    const publishedAt = new Date("2026-05-16T10:00:00.000Z");
    const resolved = resolveLifecycle({
      ...base(),
      status: "published",
      periodState: "published",
      periodStatus: "published",
      archived: false,
      autoPublished: true,
      autoArchived: false,
      publishedAt,
      publishedById: "22222222-2222-2222-2222-222222222222",
      reopenedAt: null,
    });

    expect(resolved).toEqual({
      status: "published",
      periodState: "published",
      periodStatus: "published",
      archived: false,
      autoPublished: true,
      autoArchived: false,
      publishedAt,
      publishedById: "22222222-2222-2222-2222-222222222222",
      reopenedAt: null,
    });
  });

  it("does NOT flatten a reopened period (status=published, state=open, status=reopened)", () => {
    const resolved = resolveLifecycle({
      ...base(),
      status: "published",
      periodState: "open",
      periodStatus: "reopened",
      archived: false,
      reopenedAt: new Date("2026-05-18T09:00:00.000Z"),
    });

    // The three machines stay distinct: deriving state from status would have
    // flipped status back to "draft" — exactly the corruption to avoid.
    expect(resolved.status).toBe("published");
    expect(resolved.periodState).toBe("open");
    expect(resolved.periodStatus).toBe("reopened");
  });

  it("round-trips an archived period without un-archiving it", () => {
    const resolved = resolveLifecycle({
      ...base(),
      status: "published",
      periodState: "archived",
      periodStatus: "published",
      archived: true,
      autoArchived: true,
    });

    expect(resolved.archived).toBe(true);
    expect(resolved.periodState).toBe("archived");
    expect(resolved.autoArchived).toBe(true);
  });
});

describe("resolveLifecycle — legacy fallback (absent fields backfill)", () => {
  it("derives a coherent published row from status alone", () => {
    const resolved = resolveLifecycle({ ...base(), status: "published" });

    // Never status="published" with a stale default periodState="open".
    expect(resolved.periodState).toBe("published");
    expect(resolved.periodStatus).toBe("published");
    expect(resolved.archived).toBe(false);
    expect(resolved.autoPublished).toBe(false);
    expect(resolved.autoArchived).toBe(false);
    expect(resolved.publishedAt).toBeNull();
    expect(resolved.publishedById).toBeNull();
    expect(resolved.reopenedAt).toBeNull();
  });

  it("derives a coherent draft/open row from status alone", () => {
    const resolved = resolveLifecycle({ ...base(), status: "draft" });

    expect(resolved.periodState).toBe("open");
    expect(resolved.periodStatus).toBe("open");
    expect(resolved.archived).toBe(false);
  });

  it("derives periodState='archived' when only the archived flag is present", () => {
    const resolved = resolveLifecycle({
      ...base(),
      status: "published",
      archived: true,
    });

    expect(resolved.archived).toBe(true);
    expect(resolved.periodState).toBe("archived");
  });
});
