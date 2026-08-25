import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  analyzeLifecycleWrites,
  type LifecycleExemption,
} from "./lifecycle-write-analyzer.js";
import {
  programFromTsconfig,
  syntheticProgram,
} from "./lifecycle-write-program.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(TEST_DIR, "../../../..");
const SYNTHETIC_FILE = resolve(TEST_DIR, "fixture.ts");
const PROGRAM_SCAN_TIMEOUT_MS = 60_000;

const PRELUDE = `
  import { buildTransition, type LifecycleWrite } from "./period-transition";
  interface ReportDelegate {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<unknown>;
    upsert(args: unknown): Promise<unknown>;
  }
  declare const prisma: { report: ReportDelegate };
`;

function violations(source: string, fileName = SYNTHETIC_FILE) {
  const program = syntheticProgram(fileName, `${PRELUDE}\n${source}`);
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) throw new Error(`Synthetic source missing: ${fileName}`);
  return analyzeLifecycleWrites(program, [sourceFile]);
}

function fields(source: string): readonly string[] {
  return violations(source)
    .map((violation) => violation.field)
    .sort();
}

describe("lifecycle-write-gate repository scan", () => {
  it(
    "allows only resolved transition-owned lifecycle writes",
    () => {
      const program = programFromTsconfig(resolve(API_ROOT, "tsconfig.json"));
      const sources = program.getSourceFiles().filter((source) => {
        const path = source.fileName;
        return (
          path.startsWith(resolve(API_ROOT, "src")) &&
          path.endsWith(".ts") &&
          !path.endsWith(".d.ts") &&
          !path.includes(".test.") &&
          !path.includes(".fixtures.") &&
          !path.includes(`${resolve(API_ROOT, "src/test-utils")}/`)
        );
      });

      expect(sources.length).toBeGreaterThan(50);
      expect(analyzeLifecycleWrites(program, sources)).toEqual([]);
    },
    PROGRAM_SCAN_TIMEOUT_MS,
  );
});

describe("lifecycle-write-gate planted negatives", () => {
  it("rejects direct governed fields", () => {
    expect(
      fields(`prisma.report.update({ data: { periodState: "published" } });`),
    ).toEqual(["periodState"]);
  });

  it("resolves delegate aliases and computed delegate access", () => {
    expect(
      fields(`
        const delegate = prisma.report;
        delegate.update({ data: { status: "published" } });
        prisma["report"]["update"]({ data: { archived: true } });
      `),
    ).toEqual(["archived", "status"]);
  });

  it("resolves direct and destructured write-method aliases", () => {
    expect(
      fields(`
        const update = prisma.report.update;
        const { updateMany } = prisma.report;
        update({ data: { status: "published" } });
        updateMany({ data: { archived: true } });
      `),
    ).toEqual(["archived", "status"]);
  });

  it("fails closed for a dynamically computed report method", () => {
    expect(
      fields(`
        declare const method: "update" | "updateMany";
        prisma.report[method]({ data: buildTransition() });
      `),
    ).toEqual(["<unresolved>"]);
  });

  it("resolves data variables and helper returns", () => {
    expect(
      fields(`
        const data = { periodStatus: "published" };
        const lifecycle = () => ({ autoPublished: true });
        prisma.report.update({ data });
        prisma.report.update({ data: lifecycle() });
      `),
    ).toEqual(["autoPublished", "periodStatus"]);
  });

  it("rejects governed fields hidden by conditionals and spreads", () => {
    expect(
      fields(`
        const unsafe = { publishedAt: new Date() };
        prisma.report.update({
          data: Math.random() > 0.5
            ? { ...unsafe }
            : { publishedById: "user-1" },
        });
      `),
    ).toEqual(["publishedAt", "publishedById"]);
  });

  it("fails closed for a dynamically computed data field", () => {
    expect(
      fields(`
        const suffix = "State";
        prisma.report.update({ data: { ["period" + suffix]: "published" } });
      `),
    ).toEqual(["<unresolved>"]);
  });

  it("fails closed when write data provenance is unresolved", () => {
    expect(
      fields(`
        declare function externalData(): unknown;
        prisma.report.update({ data: externalData() });
      `),
    ).toEqual(["<unresolved>"]);
  });

  it("accepts transition spreads and resolved non-lifecycle data", () => {
    expect(
      violations(`
        const data = {
          name: "Week 32",
          ...buildTransition(),
        };
        prisma.report.update({ data });
        prisma.report.update({ data: { publishedSnapshot: {} } });
      `),
    ).toEqual([]);
  });

  it("trusts only the transition module's branded helper parameter", () => {
    expect(
      violations(`
        function persist(data: LifecycleWrite) {
          prisma.report.update({ data });
        }
        persist(buildTransition());
      `),
    ).toEqual([]);
  });

  it("does not trust a local lookalike type", () => {
    expect(
      fields(`
        interface LocalLifecycleWrite { status: string }
        declare const data: LocalLifecycleWrite;
        prisma.report.update({ data });
      `),
    ).toEqual(["<unresolved>"]);
  });

  it("rejects forging the transition brand before a helper call", () => {
    expect(
      fields(`
        function persist(data: LifecycleWrite) {
          prisma.report.update({ data });
        }
        persist({ status: "published" } as LifecycleWrite);
      `),
    ).toEqual(["<forged-transition>"]);
  });
});

describe("lifecycle-write-gate exemptions", () => {
  const ownerFile = resolve(TEST_DIR, "period-transition-owner.ts");
  const exemption: LifecycleExemption = {
    ref: "TRANSITION-OWNER",
    ownerSuffix: "period-transition-owner.ts",
  };

  function exemptionViolations(
    marker: string,
    fileName = ownerFile,
    exemptions: readonly LifecycleExemption[] = [exemption],
  ) {
    const source = `${PRELUDE}\n${marker}\nprisma.report.update({ data: { status: "published" } });`;
    const program = syntheticProgram(fileName, source);
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) throw new Error(`Synthetic source missing: ${fileName}`);
    return analyzeLifecycleWrites(program, [sourceFile], exemptions);
  }

  it("accepts one exact referenced marker in its configured owner", () => {
    expect(
      exemptionViolations(
        "// lifecycle-write-gate-allow(ref=TRANSITION-OWNER)",
      ),
    ).toEqual([]);
  });

  it.each([
    ["unknown", "// lifecycle-write-gate-allow(ref=UNKNOWN)"],
    ["malformed", "// lifecycle-write-gate-allow TRANSITION-OWNER"],
  ])("rejects %s exemptions", (_label, marker) => {
    expect(exemptionViolations(marker)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "<exemption>" }),
      ]),
    );
  });

  it("rejects a valid ref outside its configured owner", () => {
    expect(
      exemptionViolations(
        "// lifecycle-write-gate-allow(ref=TRANSITION-OWNER)",
        resolve(TEST_DIR, "other-owner.ts"),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "exemption outside its owner" }),
      ]),
    );
  });

  it("rejects configured exemptions that no write references", () => {
    const program = syntheticProgram(ownerFile, PRELUDE);
    const sourceFile = program.getSourceFile(ownerFile);
    if (!sourceFile) throw new Error(`Synthetic source missing: ${ownerFile}`);
    expect(analyzeLifecycleWrites(program, [sourceFile], [exemption])).toEqual([
      expect.objectContaining({
        reason: "unreferenced exemption TRANSITION-OWNER",
      }),
    ]);
  });
});
