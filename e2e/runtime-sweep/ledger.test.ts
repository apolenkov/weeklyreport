import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type Action,
  type CoverageCell,
  type CoverageVerdict,
  type EvidenceDimension,
  type EvidenceKind,
  type EvidenceRef,
  type Oracle,
  type StateAxes,
} from "./contracts.ts";
import {
  appendCoverageCell,
  LedgerValidationError,
  readCoverageLedger,
  verifyCoverageLedger,
} from "./ledger.ts";

const SOURCE_SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
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
const control = {
  controlKey: "save",
  cellId: "cell-a",
  ariaRole: "button",
  accessibleName: "Save",
  enabled: true,
  order: 0,
  actionResult: {
    kind: "exercised" as const,
    result: "pass" as const,
    evidenceIds: ["function-artifact"],
  },
};

function evidence(
  dimension: EvidenceDimension,
  kind: EvidenceKind,
  artifactId: string,
  cellId = "cell-a",
): EvidenceRef {
  return {
    artifactId,
    kind,
    dimension,
    archivePath: `baseline/${artifactId}`,
    digest: DIGEST,
    capturedAt: "2026-08-04T00:00:00Z",
    cellId,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
  };
}

function makeCell(
  cellId = "cell-a",
  verdict: CoverageVerdict = "pass",
): CoverageCell {
  const functionRef = evidence("function", "api", "function-artifact", cellId);
  const accessibilityRef = evidence(
    "accessibility",
    "axe",
    "accessibility-artifact",
    cellId,
  );
  const visualRef = evidence("visual", "screenshot", "visual-artifact", cellId);
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
    controls: [{ ...control, cellId }],
    evidence: {
      before: [functionRef],
      action: [accessibilityRef],
      after: [visualRef],
      observations: [],
      inapplicable: [],
    },
    verdict,
  };
}

const options = {
  sourceSha: SOURCE_SHA,
  expectedCellIds: ["cell-a", "cell-b"],
  requireFinalPass: true,
};

describe("runtime sweep ledger", () => {
  it("rejects duplicate cells and mixed source SHAs", () => {
    expect(() =>
      verifyCoverageLedger([makeCell(), makeCell()], options),
    ).toThrow(LedgerValidationError);
    const mixed = { ...makeCell(), sourceSha: "c".repeat(40) };
    expect(() =>
      verifyCoverageLedger([mixed], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/source SHA/);
  });

  it("rejects missing evidence, unreasoned omissions, and non-pass final cells", () => {
    const missingVisual: CoverageCell = {
      ...makeCell(),
      evidence: { ...makeCell().evidence, after: [] },
    };
    expect(() =>
      verifyCoverageLedger([missingVisual], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/visual evidence/);
    const omitted: CoverageCell = {
      ...makeCell(),
      controls: [
        {
          ...control,
          cellId: "cell-a",
          accessibleName: " ",
          actionResult: {
            kind: "not-exercised",
            policy: "unsafe",
            reason: " ",
          },
        },
      ],
    };
    expect(() =>
      verifyCoverageLedger([omitted], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/accessible name|unreasoned omission/);
    const reasonedOmission: CoverageCell = {
      ...makeCell(),
      controls: [
        {
          ...control,
          actionResult: {
            kind: "not-exercised",
            policy: "unsafe",
            reason: "irreversible action is not declared for this pass",
          },
        },
      ],
    };
    expect(() =>
      verifyCoverageLedger([reasonedOmission], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/not exercised in the final ledger/);
    expect(() =>
      verifyCoverageLedger([makeCell("cell-a", "blocked")], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/final verdict/);
  });

  it("proves zero-gap counts when every expected cell passes", () => {
    const result = verifyCoverageLedger(
      [makeCell(), makeCell("cell-b")],
      options,
    );
    expect(result.missingCellIds).toEqual([]);
    expect(result.extraCellIds).toEqual([]);
    expect(result.counts.pass).toBe(2);
  });

  it("appends and reads JSONL without rewriting prior cells", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-sweep-ledger-"));
    const path = join(directory, "coverage.jsonl");
    try {
      await appendCoverageCell(path, makeCell(), { sourceSha: SOURCE_SHA });
      await appendCoverageCell(path, makeCell("cell-b"), {
        sourceSha: SOURCE_SHA,
      });
      const cells = await readCoverageLedger(path);
      expect(cells.map((cell) => cell.cellId)).toEqual(["cell-a", "cell-b"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
