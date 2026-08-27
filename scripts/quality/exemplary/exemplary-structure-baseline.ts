import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import {
  STRUCTURAL_PRODUCT_ROOTS,
  STRUCTURAL_RULE_IDS,
  type StructuralRuleId,
} from "./exemplary-structure-contract.ts";
import { measureStructuralInventory } from "./exemplary-structure-inventory.ts";
import { runStructuralBoundaryProbes } from "./exemplary-structure-probe.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const BASELINE_PATH = `${REPO_ROOT}scripts/quality/exemplary/exemplary-structure-baseline.json`;
const FINAL_PATH = `${REPO_ROOT}scripts/quality/exemplary/exemplary-structure-final.json`;
const GIT_BIN = "/usr/bin/git";

interface InventoryExpectation {
  readonly fileCount: number;
  readonly fileDigest: string;
  readonly contentDigest?: string;
  readonly findingCount: number;
  readonly affectedFileCount: number;
  readonly byRule: Readonly<Record<StructuralRuleId, number>>;
  readonly configDigest: string;
  readonly classification: string;
}

interface StructuralEvidenceBaseline {
  readonly source: {
    readonly branch: string;
    readonly sha: string;
    readonly tree: string;
  };
  readonly product: InventoryExpectation & {
    readonly inlineSuppressions: number;
    readonly perFileWeakenings: number;
  };
  readonly control: InventoryExpectation;
  readonly archiveEvidence: string;
}

export interface StructuralFinalEvidence {
  readonly source: StructuralEvidenceBaseline["source"] & {
    readonly binding: "HEAD" | "WORKTREE";
  };
  readonly product: InventoryExpectation & {
    readonly contentDigest: string;
    readonly inlineSuppressions: number;
    readonly perFileWeakenings: number;
    readonly notStrictConfigFileCount: number;
  };
  readonly archiveEvidence: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredRecord = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (!isRecord(value))
    throw new Error(`Invalid structural baseline: ${label}`);
  return value;
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Invalid structural baseline string: ${label}`);
  return value;
};

const requiredCount = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new Error(`Invalid structural baseline count: ${label}`);
  return value;
};

const ruleCounts = (
  value: unknown,
  label: string,
): Readonly<Record<StructuralRuleId, number>> => {
  const record = requiredRecord(value, label);
  return {
    "max-lines": requiredCount(record["max-lines"], `${label}.max-lines`),
    "max-lines-per-function": requiredCount(
      record["max-lines-per-function"],
      `${label}.max-lines-per-function`,
    ),
    complexity: requiredCount(record.complexity, `${label}.complexity`),
    "sonarjs/cognitive-complexity": requiredCount(
      record["sonarjs/cognitive-complexity"],
      `${label}.sonarjs/cognitive-complexity`,
    ),
  };
};

const expectation = (
  value: unknown,
  label: string,
  includeContentDigest = false,
): InventoryExpectation => {
  const record = requiredRecord(value, label);
  return {
    fileCount: requiredCount(record.fileCount, `${label}.fileCount`),
    fileDigest: requiredString(record.fileDigest, `${label}.fileDigest`),
    ...(includeContentDigest
      ? {
          contentDigest: requiredString(
            record.contentDigest,
            `${label}.contentDigest`,
          ),
        }
      : {}),
    findingCount: requiredCount(record.findingCount, `${label}.findingCount`),
    affectedFileCount: requiredCount(
      record.affectedFileCount,
      `${label}.affectedFileCount`,
    ),
    byRule: ruleCounts(record.byRule, `${label}.byRule`),
    configDigest: requiredString(record.configDigest, `${label}.configDigest`),
    classification: requiredString(
      record.classification,
      `${label}.classification`,
    ),
  };
};

export const sourceRecord = (value: unknown) => {
  const source = requiredRecord(value, "source");
  return {
    branch: requiredString(source.branch, "source.branch"),
    sha: requiredString(source.sha, "source.sha"),
    tree: requiredString(source.tree, "source.tree"),
  };
};

const readBaseline = (): StructuralEvidenceBaseline => {
  const value: unknown = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const record = requiredRecord(value, "root");
  const product = requiredRecord(record.product, "product");
  return {
    source: sourceRecord(record.source),
    product: {
      ...expectation(product, "product"),
      inlineSuppressions: requiredCount(
        product.inlineSuppressions,
        "product.inlineSuppressions",
      ),
      perFileWeakenings: requiredCount(
        product.perFileWeakenings,
        "product.perFileWeakenings",
      ),
    },
    control: expectation(record.control, "control"),
    archiveEvidence: requiredString(record.archiveEvidence, "archiveEvidence"),
  };
};

export const readFinalEvidence = (): StructuralFinalEvidence => {
  const value: unknown = JSON.parse(readFileSync(FINAL_PATH, "utf8"));
  const record = requiredRecord(value, "root");
  const source = requiredRecord(record.source, "source");
  const product = requiredRecord(record.product, "product");
  const binding = requiredString(source.binding, "source.binding");
  if (binding !== "HEAD" && binding !== "WORKTREE")
    throw new Error("Invalid structural final source.binding");
  return {
    source: { ...sourceRecord(source), binding },
    product: {
      ...expectation(product, "product", true),
      contentDigest: requiredString(
        product.contentDigest,
        "product.contentDigest",
      ),
      inlineSuppressions: requiredCount(
        product.inlineSuppressions,
        "product.inlineSuppressions",
      ),
      perFileWeakenings: requiredCount(
        product.perFileWeakenings,
        "product.perFileWeakenings",
      ),
      notStrictConfigFileCount: requiredCount(
        product.notStrictConfigFileCount,
        "product.notStrictConfigFileCount",
      ),
    },
    archiveEvidence: requiredString(record.archiveEvidence, "archiveEvidence"),
  };
};

export const inventoryExpectation = async (
  denominator: "product" | "all-source",
  includeContentDigest = false,
) => {
  const inventory = await measureStructuralInventory({
    denominator,
    scopes: STRUCTURAL_PRODUCT_ROOTS,
  });
  const configGroups = inventory.effectiveConfigGroups;
  const config = configGroups[0];
  const nativeProductConfigIsStrict =
    denominator === "product" &&
    inventory.denominator.fileCount > 0 &&
    configGroups.length === 1 &&
    inventory.suppressions.strictEnforcement.notStrictFileCount === 0;
  return {
    inventory,
    comparable: {
      fileCount: inventory.denominator.fileCount,
      fileDigest: inventory.denominator.fileDigest,
      ...(includeContentDigest
        ? { contentDigest: inventory.denominator.contentDigest }
        : {}),
      findingCount: inventory.candidate.findingCount,
      affectedFileCount: inventory.candidate.fileCount,
      byRule: Object.fromEntries(
        STRUCTURAL_RULE_IDS.map((ruleId) => [
          ruleId,
          inventory.candidate.byRule[ruleId].occurrences,
        ]),
      ),
      configDigest:
        configGroups.length === 1
          ? (config?.configDigest ?? "missing")
          : configGroups.length === 0
            ? "missing"
            : "ambiguous",
      classification:
        denominator === "product"
          ? nativeProductConfigIsStrict
            ? "REAL"
            : "CONFIG"
          : inventory.classification,
    },
  };
};

export const currentSource = () => ({
  branch: execFileSync(GIT_BIN, ["branch", "--show-current"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim(),
  sha: execFileSync(GIT_BIN, ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim(),
  tree: execFileSync(GIT_BIN, ["rev-parse", "HEAD^{tree}"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim(),
});

export const stable = (value: unknown): string => JSON.stringify(value);

export const checkStructuralBaseline = async () => {
  const baseline = readBaseline();
  const product = await inventoryExpectation("product");
  const control = await inventoryExpectation("all-source");
  const probes = await runStructuralBoundaryProbes();
  const failures: string[] = [];
  const recordedTree = execFileSync(
    GIT_BIN,
    ["rev-parse", `${baseline.source.sha}^{tree}`],
    { cwd: REPO_ROOT, encoding: "utf8" },
  ).trim();
  if (recordedTree !== baseline.source.tree) failures.push("source-tree");
  if (
    stable(product.comparable) !==
    stable(expectation(baseline.product, "product"))
  )
    failures.push("product-inventory");
  if (stable(control.comparable) !== stable(baseline.control))
    failures.push("control-inventory");
  if (
    product.inventory.suppressions.inlineCount !==
    baseline.product.inlineSuppressions
  )
    failures.push("inline-suppressions");
  if (
    product.inventory.suppressions.perFileWeakeningCount !==
    baseline.product.perFileWeakenings
  )
    failures.push("per-file-weakenings");
  const unclassified = STRUCTURAL_RULE_IDS.filter(
    (ruleId) => probes.rules[ruleId]?.classification !== "REAL",
  );
  if (unclassified.length > 0) failures.push("probe-classification");
  if (!existsSync(baseline.archiveEvidence)) failures.push("archive-evidence");
  return {
    classification: failures.length === 0 ? "REAL" : "NOT_PROVEN",
    source: baseline.source,
    product: product.comparable,
    control: control.comparable,
    unclassified,
    failures,
    archiveEvidence: baseline.archiveEvidence,
  };
};
