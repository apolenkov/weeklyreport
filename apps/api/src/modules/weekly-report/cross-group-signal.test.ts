import { describe, expect, it } from "vitest";

import {
  computeCrossGroupSignal,
  computeCrossGroupSignalFromSnapshotProjects,
} from "./cross-group-signal";
import type { WeeklyReportScopeSession } from "./weekly-report.service";

const GROUP_A = "a0000000-0000-4000-a000-00000000000a";
const GROUP_B = "a0000000-0000-4000-a000-00000000000b";
const PRODUCT_1 = "a0000000-0000-4000-a000-0000000000d1";
const PRODUCT_2 = "a0000000-0000-4000-a000-0000000000d2";

const headA: WeeklyReportScopeSession = {
  userId: "00000000-0000-4000-a000-0000000000f1",
  role: "head",
  reportingGroupId: GROUP_A,
};

function project(id: string, ownerGroupId: string | null) {
  return { id, lead: { reportingGroupId: ownerGroupId } };
}

describe("computeCrossGroupSignal", () => {
  it("flags a surfaced product whose owner lead lives in another group", () => {
    const signal = computeCrossGroupSignal(headA, [
      project(PRODUCT_1, GROUP_B),
    ]);

    expect(signal).toEqual({ productIds: [PRODUCT_1], groupIds: [GROUP_B] });
  });

  it("collapses two cross-group products into one signal with deduped groupIds", () => {
    const signal = computeCrossGroupSignal(headA, [
      project(PRODUCT_1, GROUP_B),
      project(PRODUCT_2, GROUP_B),
    ]);

    expect(signal).toEqual({
      productIds: [PRODUCT_1, PRODUCT_2],
      groupIds: [GROUP_B],
    });
  });

  it("does NOT count a product the caller's own group owns (owned-but-joined-elsewhere)", () => {
    // Owner group == caller's group → not cross-group, no matter which
    // other groups the product is also joined to via GroupProduct.
    const signal = computeCrossGroupSignal(headA, [
      project(PRODUCT_1, GROUP_A),
    ]);

    expect(signal).toBeNull();
  });

  it("returns null for admin sessions even when foreign products surface", () => {
    const admin: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000f2",
      role: "admin",
    };

    const signal = computeCrossGroupSignal(admin, [
      project(PRODUCT_1, GROUP_B),
    ]);

    expect(signal).toBeNull();
  });

  it("returns null without a session (unauthenticated paths are not audited)", () => {
    const signal = computeCrossGroupSignal(undefined, [
      project(PRODUCT_1, GROUP_B),
    ]);

    expect(signal).toBeNull();
  });

  it("ignores products with no lead or no owner group (cannot attribute an owner)", () => {
    const signal = computeCrossGroupSignal(headA, [
      { id: PRODUCT_1, lead: null },
      project(PRODUCT_2, null),
    ]);

    expect(signal).toBeNull();
  });

  it("uses viewerGroupAccess as the allowed set for viewer sessions", () => {
    const viewer: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000f3",
      role: "viewer",
      viewerGroupAccess: [GROUP_A],
    };

    expect(
      computeCrossGroupSignal(viewer, [project(PRODUCT_1, GROUP_A)]),
    ).toBeNull();
    expect(
      computeCrossGroupSignal(viewer, [project(PRODUCT_1, GROUP_B)]),
    ).toEqual({ productIds: [PRODUCT_1], groupIds: [GROUP_B] });
  });

  it("returns null when the session carries no allowed groups at all", () => {
    const groupless: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000f4",
      role: "head",
    };

    expect(
      computeCrossGroupSignal(groupless, [project(PRODUCT_1, GROUP_B)]),
    ).toBeNull();
  });
});

// Snapshot path: frozen ownerGroupId keeps signal eligibility after live archive.
describe("computeCrossGroupSignalFromSnapshotProjects", () => {
  function snapshotProject(projectId: string, ownerGroupId?: string | null) {
    return { projectId, ownerGroupId };
  }

  it("flags a snapshot product whose frozen owner group is not the caller's", () => {
    const signal = computeCrossGroupSignalFromSnapshotProjects(headA, [
      snapshotProject(PRODUCT_1, GROUP_B),
    ]);

    expect(signal).toEqual({ productIds: [PRODUCT_1], groupIds: [GROUP_B] });
  });

  it("collapses multiple cross-group products in one section into a single deduped signal", () => {
    const signal = computeCrossGroupSignalFromSnapshotProjects(headA, [
      snapshotProject(PRODUCT_1, GROUP_B),
      snapshotProject(PRODUCT_2, GROUP_B),
    ]);

    expect(signal).toEqual({
      productIds: [PRODUCT_1, PRODUCT_2],
      groupIds: [GROUP_B],
    });
  });

  it("dedupes a product that surfaces in two sections into one entry", () => {
    const signal = computeCrossGroupSignalFromSnapshotProjects(headA, [
      snapshotProject(PRODUCT_1, GROUP_B),
      snapshotProject(PRODUCT_1, GROUP_B),
    ]);

    expect(signal).toEqual({ productIds: [PRODUCT_1], groupIds: [GROUP_B] });
  });

  it("excludes a product the caller's own group owns", () => {
    const signal = computeCrossGroupSignalFromSnapshotProjects(headA, [
      snapshotProject(PRODUCT_1, GROUP_A),
    ]);

    expect(signal).toBeNull();
  });

  it("returns null for admin sessions", () => {
    const admin: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000f2",
      role: "admin",
    };

    expect(
      computeCrossGroupSignalFromSnapshotProjects(admin, [
        snapshotProject(PRODUCT_1, GROUP_B),
      ]),
    ).toBeNull();
  });

  it("returns null when the session carries no allowed groups (empty scope)", () => {
    const groupless: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000f4",
      role: "head",
    };

    expect(
      computeCrossGroupSignalFromSnapshotProjects(groupless, [
        snapshotProject(PRODUCT_1, GROUP_B),
      ]),
    ).toBeNull();
  });

  it("never treats a missing or null frozen owner as cross-group", () => {
    expect(
      computeCrossGroupSignalFromSnapshotProjects(headA, [
        snapshotProject(PRODUCT_1),
        snapshotProject(PRODUCT_2, null),
      ]),
    ).toBeNull();
  });
});
