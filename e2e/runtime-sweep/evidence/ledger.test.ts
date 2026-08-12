import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { CoverageCell } from "../source/contracts.ts";
import {
  appendCoverageCell,
  LedgerValidationError,
  readCoverageLedger,
  verifyCoverageLedger,
  writeOrderedCoverageLedger,
} from "./ledger.ts";
import { control, makeCell, options, SOURCE_SHA } from "./ledger-fixtures.ts";

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
    const completeEvidence = makeCell().evidence;
    const missingRuntime: CoverageCell = {
      ...makeCell(),
      evidence: {
        ...completeEvidence,
        after: completeEvidence.after.filter(
          ({ dimension }) => dimension === "visual",
        ),
      },
    };
    expect(() =>
      verifyCoverageLedger([missingRuntime], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toThrow(/runtime evidence/);
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

  it("accepts a reasoned runtime inapplicable entry", () => {
    const completeEvidence = makeCell().evidence;
    const runtimeInapplicable: CoverageCell = {
      ...makeCell(),
      evidence: {
        ...completeEvidence,
        after: completeEvidence.after.filter(
          ({ dimension }) => dimension !== "runtime",
        ),
        inapplicable: [
          {
            dimension: "runtime",
            reason:
              "This read-only fixture has no service-side runtime surface",
          },
        ],
      },
    };
    expect(
      verifyCoverageLedger([runtimeInapplicable], {
        ...options,
        expectedCellIds: ["cell-a"],
      }),
    ).toMatchObject({ counts: { pass: 1 } });
  });

  it("allows reasoned contextual controls on navigation cells", () => {
    const navigationAction = {
      controlKey: "route",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    } as const;
    const navigationCell: CoverageCell = {
      ...makeCell(),
      action: navigationAction,
      execution: { kind: "navigation", action: navigationAction },
      controls: [
        {
          ...control,
          actionResult: {
            kind: "not-exercised",
            policy: "inapplicable",
            reason: "Navigation case does not execute contextual controls",
          },
        },
      ],
    };
    expect(
      verifyCoverageLedger([navigationCell], {
        ...options,
        expectedCellIds: [navigationCell.cellId],
      }),
    ).toMatchObject({ counts: { pass: 1 } });
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
      await expect(
        appendCoverageCell(path, makeCell(), { sourceSha: SOURCE_SHA }),
      ).rejects.toThrow(/duplicate cell id cell-a/);
      const cells = await readCoverageLedger(path);
      expect(cells.map((cell) => cell.cellId)).toEqual(["cell-a", "cell-b"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("writes a single immutable ledger in expected matrix order", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-sweep-ledger-"));
    const path = join(directory, "baseline", "coverage-cells.jsonl");
    try {
      await writeOrderedCoverageLedger(path, [makeCell("cell-b"), makeCell()], {
        sourceSha: SOURCE_SHA,
        expectedCellIds: ["cell-a", "cell-b"],
      });
      expect(
        (await readCoverageLedger(path)).map(({ cellId }) => cellId),
      ).toEqual(["cell-a", "cell-b"]);
      await expect(
        writeOrderedCoverageLedger(path, [makeCell(), makeCell("cell-b")], {
          sourceSha: SOURCE_SHA,
          expectedCellIds: ["cell-a", "cell-b"],
        }),
      ).rejects.toMatchObject({ code: "EEXIST" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
