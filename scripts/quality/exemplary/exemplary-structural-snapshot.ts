import {
  STRUCTURAL_PRODUCT_SLICES,
  type StructuralRuleId,
  structuralSliceForFile,
} from "./exemplary-structure-contract.ts";
import type { measureStructuralInventory } from "./exemplary-structure-inventory.ts";

type StructuralInventory = Awaited<
  ReturnType<typeof measureStructuralInventory>
>;

export interface StructuralDebtCounts {
  readonly findingCount: number;
  readonly affectedFileCount: number;
  readonly byRule: Readonly<Record<StructuralRuleId, number>>;
}

export interface StructuralFloorSnapshot {
  readonly denominatorFileCount: number;
  readonly total: StructuralDebtCounts;
  readonly bySlice: Readonly<Record<string, StructuralDebtCounts>>;
  readonly inlineSuppressions: number;
  readonly perFileWeakenings: number;
  readonly notStrictConfigFileCount: number;
  readonly notStrictConfigBySlice: Readonly<Record<string, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonnegativeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new Error(`Invalid structural floor counter: ${label}`);
  return value;
};

const parseDebtCounts = (
  value: unknown,
  label: string,
): StructuralDebtCounts => {
  if (!isRecord(value) || !isRecord(value.byRule))
    throw new Error(`Invalid structural floor debt counts: ${label}`);
  const byRule = {
    "max-lines": nonnegativeInteger(
      value.byRule["max-lines"],
      `${label}.byRule.max-lines`,
    ),
    "max-lines-per-function": nonnegativeInteger(
      value.byRule["max-lines-per-function"],
      `${label}.byRule.max-lines-per-function`,
    ),
    complexity: nonnegativeInteger(
      value.byRule.complexity,
      `${label}.byRule.complexity`,
    ),
    "sonarjs/cognitive-complexity": nonnegativeInteger(
      value.byRule["sonarjs/cognitive-complexity"],
      `${label}.byRule.sonarjs/cognitive-complexity`,
    ),
  };
  return {
    findingCount: nonnegativeInteger(
      value.findingCount,
      `${label}.findingCount`,
    ),
    affectedFileCount: nonnegativeInteger(
      value.affectedFileCount,
      `${label}.affectedFileCount`,
    ),
    byRule,
  };
};

const parseSliceCounts = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value))
    throw new Error("Invalid structural strict-config slice denominator");
  const expectedSlices = STRUCTURAL_PRODUCT_SLICES.map(({ id }) => id);
  if (
    Object.keys(value).length !== expectedSlices.length ||
    expectedSlices.some((id) => !(id in value))
  )
    throw new Error("Invalid structural strict-config slice denominator");
  return Object.fromEntries(
    expectedSlices.map((id) => [
      id,
      nonnegativeInteger(value[id], `notStrictConfigBySlice.${id}`),
    ]),
  );
};

export const parseStructuralFloorSnapshot = (
  value: unknown,
): StructuralFloorSnapshot => {
  if (!isRecord(value) || !isRecord(value.bySlice))
    throw new Error("Invalid structural floor snapshot");
  const bySlice = value.bySlice;
  const expectedSlices = new Set(STRUCTURAL_PRODUCT_SLICES.map(({ id }) => id));
  const actualSlices = new Set(Object.keys(bySlice));
  if (
    expectedSlices.size !== actualSlices.size ||
    [...expectedSlices].some((id) => !actualSlices.has(id))
  )
    throw new Error("Invalid structural floor slice denominator");
  return {
    denominatorFileCount: nonnegativeInteger(
      value.denominatorFileCount,
      "denominatorFileCount",
    ),
    total: parseDebtCounts(value.total, "total"),
    bySlice: Object.fromEntries(
      STRUCTURAL_PRODUCT_SLICES.map(({ id }) => [
        id,
        parseDebtCounts(bySlice[id], `bySlice.${id}`),
      ]),
    ),
    inlineSuppressions: nonnegativeInteger(
      value.inlineSuppressions,
      "inlineSuppressions",
    ),
    perFileWeakenings: nonnegativeInteger(
      value.perFileWeakenings,
      "perFileWeakenings",
    ),
    notStrictConfigFileCount: nonnegativeInteger(
      value.notStrictConfigFileCount,
      "notStrictConfigFileCount",
    ),
    notStrictConfigBySlice: parseSliceCounts(value.notStrictConfigBySlice),
  };
};

const debtCounts = (
  findings: StructuralInventory["candidate"]["findings"],
): StructuralDebtCounts => ({
  findingCount: findings.length,
  affectedFileCount: new Set(findings.map((finding) => finding.file)).size,
  byRule: {
    "max-lines": findings.filter((finding) => finding.ruleId === "max-lines")
      .length,
    "max-lines-per-function": findings.filter(
      (finding) => finding.ruleId === "max-lines-per-function",
    ).length,
    complexity: findings.filter((finding) => finding.ruleId === "complexity")
      .length,
    "sonarjs/cognitive-complexity": findings.filter(
      (finding) => finding.ruleId === "sonarjs/cognitive-complexity",
    ).length,
  },
});

export const structuralFloorSnapshot = (
  inventory: StructuralInventory,
): StructuralFloorSnapshot => ({
  denominatorFileCount: inventory.denominator.fileCount,
  total: debtCounts(inventory.candidate.findings),
  bySlice: Object.fromEntries(
    STRUCTURAL_PRODUCT_SLICES.map(({ id }) => [
      id,
      debtCounts(
        inventory.candidate.findings.filter(
          (finding) => structuralSliceForFile(finding.file) === id,
        ),
      ),
    ]),
  ),
  inlineSuppressions: inventory.suppressions.inlineCount,
  perFileWeakenings: inventory.suppressions.perFileWeakeningCount,
  notStrictConfigFileCount:
    inventory.suppressions.strictEnforcement.notStrictFileCount,
  notStrictConfigBySlice:
    inventory.suppressions.strictEnforcement.notStrictBySlice,
});
