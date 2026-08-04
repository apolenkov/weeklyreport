import { describe, expect, it } from "vitest";

import type {
  Action,
  CoverageCell,
  EvidenceBundle,
  Oracle,
  StateAxes,
} from "./contracts.ts";
import {
  type DriverMergeOptions,
  mergeDriverResults,
} from "./driver-results.ts";

const SOURCE_SHA = "a".repeat(40);
const OTHER_SOURCE_SHA = "b".repeat(40);
const state: StateAxes = {
  profileCapability: "canonical-identities",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault: "none",
  controlTransition: "none",
};
const action: Action = {
  controlKey: "save",
  operation: "click",
  safety: "reversible",
  transition: "none",
};
const oracle: Oracle = {
  domainSpecRefs: ["exhaustive-runtime-sweep"],
  function: { required: true, expectation: "the action succeeds" },
  accessibility: { required: true, expectation: "status is announced" },
  visual: { required: true, expectation: "settled screenshot matches" },
};
const evidence: EvidenceBundle = {
  before: [],
  action: [],
  after: [],
  observations: [],
  inapplicable: [],
};

function makeCell(cellId = "cell-a"): CoverageCell {
  return {
    cellId,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
    viewport: { browser: "chromium", width: 1440, height: 900 },
    state,
    action,
    oracle,
    controls: [
      {
        controlKey: "save",
        cellId,
        ariaRole: "button",
        accessibleName: "Save",
        enabled: true,
        order: 0,
        actionResult: {
          kind: "not-exercised",
          policy: "unavailable",
          reason: "The driver has not run this cell yet",
        },
      },
      {
        controlKey: "cancel",
        cellId,
        ariaRole: "button",
        accessibleName: "Cancel",
        enabled: true,
        order: 1,
        actionResult: {
          kind: "not-exercised",
          policy: "unavailable",
          reason: "The driver has not run this cell yet",
        },
      },
    ],
    evidence,
    verdict: "pending",
  };
}

function report(
  controls: readonly string[],
  sourceSha = SOURCE_SHA,
  blockedControls: readonly string[] = [],
): string {
  return JSON.stringify({
    roleDriven: "lead",
    profile: "minimal",
    sourceSha,
    assignedCells: [
      {
        cellId: "cell-a",
        catalogRoute: "/lead/report",
        resolvedRoute: "/lead/report",
        controlKeys: ["save", "cancel"],
      },
    ],
    routesVisited: 1,
    routesPlanned: 1,
    canary: { injected: true, detected: true },
    timeline: {
      startedAt: "2026-08-04T00:00:00.000Z",
      endedAt: "2026-08-04T00:01:00.000Z",
      routes: [
        {
          route: "/lead/report",
          enteredAt: "2026-08-04T00:00:01.000Z",
          leftAt: "2026-08-04T00:00:59.000Z",
        },
      ],
    },
    controlResults: controls.map((controlKey) =>
      blockedControls.includes(controlKey)
        ? {
            cellId: "cell-a",
            controlKey,
            status: "blocked",
            evidenceRefs: [`${controlKey}-evidence`],
            reason: "The dialog was not reachable",
          }
        : {
            cellId: "cell-a",
            controlKey,
            status: "covered",
            result: "pass",
            evidenceRefs: [`${controlKey}-evidence`],
          },
    ),
    candidates: [],
  });
}

function options(reportText: string): DriverMergeOptions {
  return {
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    cells: [makeCell()],
    reportText,
    reportArchivePath: "/archive/driver/a/lead.json",
  };
}

describe("OpenCode driver result contract", () => {
  it("rejects a report from a stale source SHA", () => {
    const stale = report(["save", "cancel"], OTHER_SOURCE_SHA);

    expect(() =>
      mergeDriverResults([makeCell()], stale, options(stale)),
    ).toThrow(/source SHA/iu);
  });

  it("rejects missing and duplicate control results", () => {
    const missing = report(["save"]);
    expect(() =>
      mergeDriverResults([makeCell()], missing, options(missing)),
    ).toThrow(/missing control result/iu);

    const duplicate = report(["save", "cancel", "cancel"]);
    expect(() =>
      mergeDriverResults([makeCell()], duplicate, options(duplicate)),
    ).toThrow(/duplicate control result/iu);
  });

  it("keeps a blocked control and cell blocked", () => {
    const blockedReport = report(["save", "cancel"], SOURCE_SHA, ["cancel"]);

    const [merged] = mergeDriverResults(
      [makeCell()],
      blockedReport,
      options(blockedReport),
    );
    expect(merged?.verdict).toBe("blocked");
    expect(merged?.controls[1]?.actionResult.kind).toBe("not-exercised");
  });

  it("promotes only fully covered controls and binds a driver report artifact", () => {
    const reportText = report(["save", "cancel"]);
    const [merged] = mergeDriverResults(
      [makeCell()],
      reportText,
      options(reportText),
    );

    expect(merged?.verdict).toBe("pass");
    expect(
      merged?.controls.every(
        (control) => control.actionResult.kind === "exercised",
      ),
    ).toBe(true);
    expect(merged?.evidence.action).toHaveLength(1);
    expect(merged?.evidence.action[0]?.kind).toBe("driver-report");
    expect(merged?.evidence.action[0]?.digest).toMatch(/^[0-9a-f]{64}$/u);
  });
});
