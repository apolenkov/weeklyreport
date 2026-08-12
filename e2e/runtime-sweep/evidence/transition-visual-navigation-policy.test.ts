import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../source/contracts.ts";
import { FROZEN_LIVE_TRANSITION_VISUAL_POLICY } from "./transition-visual-evaluation.ts";
import { transitionObservationMessage } from "./transition-visual-evidence.ts";
import { policyForNavigationPair } from "./transition-visual-navigation-policy.ts";

const SOURCE_SHA = "a".repeat(40);

interface CaseOptions {
  readonly controlKey?: string;
  readonly href?: string | null;
  readonly safety?: "read-only" | "irreversible";
}

const matrixCase = (options: CaseOptions = {}): MatrixExecutableCase => {
  const href = options.href === undefined ? "/lead/report" : options.href;
  return {
    caseId: "case-cross-route-link",
    stateId: "state-cross-route-link",
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report/[reportId]/preview",
    resolvedRoute: "/lead/report/report-id/preview",
    networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
    state: {
      profileCapability: "editable-active-report",
      lifecycle: "open",
      submission: "draft",
      ownershipDensity: "single",
      permission: "allowed",
      fault: "none",
      controlTransition: "none",
    },
    kind: "executable",
    execution: {
      kind: "control",
      action: {
        controlKey: options.controlKey ?? "link:Lead%20home:1",
        operation: "click",
        safety: options.safety ?? "read-only",
        transition: "none",
        ...(href === null ? {} : { target: { role: "link", href } }),
      },
    },
  };
};

const url = (pathname: string, status: number | null = 200) => ({
  url: `http://127.0.0.1:3135${pathname}`,
  status,
});

describe("transition visual navigation policy", () => {
  it("reports boundary masking without claiming landmark matches", () => {
    const message = transitionObservationMessage({
      outcome: "pass",
      comparison: "navigation-boundary-snapshots",
      issues: [],
      movements: [],
      reviewedMasks: [],
    });

    expect(message).toContain("Snapshot-local geometry passed");
    expect(message).not.toContain("geometry matched");
  });

  it("recognizes a successful canonical route and descendant redirect", () => {
    const result = policyForNavigationPair(
      matrixCase(),
      url("/lead/report/report-id/preview"),
      url("/lead/report/report-id"),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(true);
  });

  it("recognizes successful sign-out navigation to the exact root", () => {
    const result = policyForNavigationPair(
      matrixCase({
        controlKey: "button:Sign%20out:1",
        href: null,
      }),
      url("/lead/report/report-id/preview"),
      url("/"),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(true);
  });

  it.each([
    ["form to slides", "/lead/report/report-id", "?mode=slides"],
    ["slides to form", "/lead/report/report-id?mode=slides", ""],
  ])("recognizes the canonical %s view boundary", (_label, before, query) => {
    const result = policyForNavigationPair(
      matrixCase({
        controlKey: query === "" ? "link:Edit:1" : "link:Slides:1",
        href: `/lead/report/report-id${query}`,
      }),
      url(before),
      url(`/lead/report/report-id${query}`),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(true);
  });

  it.each([
    ["same route", matrixCase(), url("/lead/report/report-id/preview")],
    [
      "arbitrary href-less button route change",
      matrixCase({ controlKey: "button:Open:1", href: null }),
      url("/"),
    ],
    [
      "sign out to the wrong route",
      matrixCase({ controlKey: "button:Sign%20out:1", href: null }),
      url("/login"),
    ],
    [
      "same-route sign out",
      matrixCase({ controlKey: "button:Sign%20out:1", href: null }),
      url("/lead/report/report-id/preview"),
    ],
    [
      "query-only button change",
      matrixCase({ controlKey: "button:Open:1", href: null }),
      url("/lead/report/report-id/preview?mode=slides"),
    ],
    [
      "cross-origin sign out",
      matrixCase({ controlKey: "button:Sign%20out:1", href: null }),
      { url: "https://example.invalid/", status: 200 },
    ],
    ["wrong route", matrixCase(), url("/admin")],
    [
      "cross origin",
      matrixCase({ href: "https://example.invalid/lead/report" }),
      url("/lead/report"),
    ],
    ["failed response", matrixCase(), url("/lead/report/report-id", 500)],
    [
      "mutating action",
      matrixCase({ href: "/lead/report", safety: "irreversible" }),
      url("/lead/report/report-id"),
    ],
  ])("keeps topology comparison strict for %s", (_label, candidate, after) => {
    const result = policyForNavigationPair(
      candidate,
      url("/lead/report/report-id/preview"),
      after,
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(false);
  });

  it.each([
    ["failed before URL", url("/lead/report/report-id/preview", 400), url("/")],
    [
      "missing after status",
      url("/lead/report/report-id/preview"),
      url("/", null),
    ],
  ])("keeps sign-out topology strict for %s", (_label, before, after) => {
    const result = policyForNavigationPair(
      matrixCase({ controlKey: "button:Sign%20out:1", href: null }),
      before,
      after,
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(false);
  });

  it.each([
    ["unrecognized view mode", "link:Grid:1", "?mode=grid"],
    ["duplicate view mode", "link:Slides:1", "?mode=slides&mode=slides"],
    ["ordinary query change", "link:All:1", "?scope=all"],
  ])("keeps topology strict for %s", (_label, controlKey, query) => {
    const target = `/lead/report/report-id${query}`;
    const result = policyForNavigationPair(
      matrixCase({ controlKey, href: target }),
      url("/lead/report/report-id"),
      url(target),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(false);
  });

  it("compares non-mode query names and values without tuple collisions", () => {
    const target = "/lead/report/report-id?a=b%3Dc&mode=slides";
    const result = policyForNavigationPair(
      matrixCase({ controlKey: "link:Slides:1", href: target }),
      url("/lead/report/report-id?a%3Db=c"),
      url(target),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(false);
  });

  it("keeps topology strict when a mode link changes the fragment", () => {
    const target = "/lead/report/report-id?mode=slides#deck";
    const result = policyForNavigationPair(
      matrixCase({ controlKey: "link:Slides:1", href: target }),
      url("/lead/report/report-id#report"),
      url(target),
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowNavigationBoundaryStableLayoutChange).toBe(false);
  });
});
