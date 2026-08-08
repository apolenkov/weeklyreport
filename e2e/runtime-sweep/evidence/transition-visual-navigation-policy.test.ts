import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import { FROZEN_LIVE_TRANSITION_VISUAL_POLICY } from "./transition-visual-evaluation.ts";
import { transitionObservationMessage } from "./transition-visual-evidence.ts";
import { policyForNavigationPair } from "./transition-visual-navigation-policy.ts";

const SOURCE_SHA = "a".repeat(40);

const matrixCase = (
  href = "/lead/report",
  safety: "read-only" | "irreversible" = "read-only",
): MatrixExecutableCase => ({
  caseId: "case-cross-route-link",
  stateId: "state-cross-route-link",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report/[reportId]/preview",
  resolvedRoute: "/lead/report/report-id/preview",
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
      controlKey: "link:Lead%20home:1",
      operation: "click",
      safety,
      transition: "none",
      target: { role: "link", href },
    },
  },
});

const url = (pathname: string, status = 200) => ({
  url: `http://127.0.0.1:3135${pathname}`,
  status,
});

describe("transition visual navigation policy", () => {
  it("reports cross-route masking without claiming landmark matches", () => {
    const message = transitionObservationMessage({
      outcome: "pass",
      comparison: "cross-route-snapshots",
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

    expect(result.allowCrossRouteStableLayoutChange).toBe(true);
  });

  it.each([
    ["same route", matrixCase(), url("/lead/report/report-id/preview")],
    ["wrong route", matrixCase(), url("/admin")],
    [
      "cross origin",
      matrixCase("https://example.invalid/lead/report"),
      url("/lead/report"),
    ],
    ["failed response", matrixCase(), url("/lead/report/report-id", 500)],
    [
      "mutating action",
      matrixCase("/lead/report", "irreversible"),
      url("/lead/report/report-id"),
    ],
  ])("keeps topology comparison strict for %s", (_label, candidate, after) => {
    const result = policyForNavigationPair(
      candidate,
      url("/lead/report/report-id/preview"),
      after,
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.allowCrossRouteStableLayoutChange).toBe(false);
  });
});
