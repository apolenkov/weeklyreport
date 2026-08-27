import { createHash } from "node:crypto";
import { posix } from "node:path";

import {
  STRICT_STRUCTURAL_LIMITS,
  STRUCTURAL_RULE_IDS,
  type StructuralRuleId,
} from "../../../eslint-config/exemplary-structure.ts";

export {
  STRUCTURAL_CYCLOMATIC_MAX,
  STRUCTURAL_FILE_MAX,
  STRUCTURAL_FUNCTION_MAX,
  STRUCTURAL_RULE_CONFIG,
  STRUCTURAL_RULE_IDS,
  type StructuralRuleId,
} from "../../../eslint-config/exemplary-structure.ts";

export const STRUCTURAL_PRODUCT_ROOTS = [
  "apps/api/src",
  "apps/web/src",
  "packages/shared/src",
  "packages/ui/src",
] as const;

type StructuralDenominator = "product" | "all-source";

export interface StructuralProductSlice {
  readonly id: string;
  readonly scopes: readonly string[];
}

export const STRUCTURAL_PRODUCT_SLICES: readonly StructuralProductSlice[] = [
  {
    id: "api-report-sections-application",
    scopes: ["apps/api/src/modules/report-sections/application"],
  },
  {
    id: "api-report-sections-infrastructure",
    scopes: ["apps/api/src/modules/report-sections/infrastructure"],
  },
  { id: "api-bullmq", scopes: ["apps/api/src/infrastructure/bullmq"] },
  {
    id: "api-throttler-lib",
    scopes: ["apps/api/src/infrastructure/throttler", "apps/api/src/lib"],
  },
  { id: "api-admin", scopes: ["apps/api/src/modules/admin"] },
  { id: "api-pdf-export", scopes: ["apps/api/src/modules/pdf-export"] },
  {
    id: "api-project-activity",
    scopes: ["apps/api/src/modules/project-activity"],
  },
  { id: "api-reminders", scopes: ["apps/api/src/modules/reminders"] },
  { id: "web-shared", scopes: ["apps/web/src/shared"] },
  { id: "web-admin", scopes: ["apps/web/src/features/admin"] },
  {
    id: "web-dashboard-organization",
    scopes: [
      "apps/web/src/features/dashboard",
      "apps/web/src/features/organization",
    ],
  },
  { id: "web-period", scopes: ["apps/web/src/features/period"] },
  {
    id: "web-report-pages-head-lead",
    scopes: [
      "apps/web/src/features/report-pages/ui/head",
      "apps/web/src/features/report-pages/ui/lead",
    ],
  },
  {
    id: "web-report-pages-weekly",
    scopes: ["apps/web/src/features/report-pages/ui/weekly"],
  },
  {
    id: "web-report-sections-model",
    scopes: ["apps/web/src/features/report-sections/model"],
  },
  {
    id: "web-report-sections-ui",
    scopes: ["apps/web/src/features/report-sections/ui"],
  },
  {
    id: "web-review-viewer",
    scopes: ["apps/web/src/features/review", "apps/web/src/features/viewer"],
  },
  {
    id: "web-slides-pdf-export",
    scopes: [
      "apps/web/src/features/slides",
      "apps/web/src/features/pdf-export",
    ],
  },
  { id: "shared", scopes: ["packages/shared/src"] },
  { id: "ui", scopes: ["packages/ui/src"] },
  { id: "api-remainder", scopes: ["apps/api/src"] },
  { id: "web-remainder", scopes: ["apps/web/src"] },
] as const;

export const TRANSITIONAL_STRUCTURAL_LIMITS = {
  "max-lines": 300,
  "max-lines-per-function": 70,
  complexity: 20,
  "sonarjs/cognitive-complexity": 10,
} as const satisfies Readonly<Record<StructuralRuleId, number>>;

const structuralRuleLimit = (entry: unknown): number | undefined => {
  if (!Array.isArray(entry)) return undefined;
  const option: unknown = entry[1];
  if (typeof option === "number") return option;
  if (
    typeof option === "object" &&
    option !== null &&
    !Array.isArray(option) &&
    typeof (option as Record<string, unknown>).max === "number"
  )
    return (option as Record<string, number>).max;
  return undefined;
};

export const structuralRuleIsGap = (entry: unknown, maximum: number): boolean =>
  !Array.isArray(entry) ||
  (entry[0] !== 2 && entry[0] !== "error") ||
  structuralRuleLimit(entry) === undefined ||
  (structuralRuleLimit(entry) ?? Number.POSITIVE_INFINITY) > maximum;

export const strictStructuralRuleGaps = (
  rules: Partial<Record<string, unknown>> | undefined,
): readonly StructuralRuleId[] =>
  STRUCTURAL_RULE_IDS.filter((ruleId) =>
    structuralRuleIsGap(rules?.[ruleId], STRICT_STRUCTURAL_LIMITS[ruleId]),
  );

export interface StructuralInventoryOptions {
  readonly denominator: StructuralDenominator;
  readonly scopes: readonly string[];
}

const normalizedScope = (raw: string): string => {
  const scope = posix.normalize(raw.replaceAll("\\", "/")).replace(/\/$/u, "");
  if (
    scope === "" ||
    scope === "." ||
    scope.startsWith("/") ||
    scope === ".." ||
    scope.startsWith("../")
  )
    throw new Error(`Invalid structural scope: ${raw}`);
  if (
    !STRUCTURAL_PRODUCT_ROOTS.some(
      (root) => scope === root || scope.startsWith(`${root}/`),
    )
  )
    throw new Error(
      `Structural scope is outside maintained product roots: ${raw}`,
    );
  return scope;
};

const argumentValue = (
  args: readonly string[],
  index: number,
  option: string,
): string => {
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${option} requires a value`);
  return value;
};

const structuralDenominator = (value: string): StructuralDenominator => {
  if (value !== "product" && value !== "all-source")
    throw new Error("--denominator must be product or all-source");
  return value;
};

export const parseStructuralInventoryArgs = (
  args: readonly string[],
): StructuralInventoryOptions => {
  const scopes: string[] = [];
  let denominator: StructuralDenominator = "product";
  const inventoryArgs = args[0] === "--" ? args.slice(1) : args;
  for (let index = 0; index < inventoryArgs.length; index += 1) {
    const arg = inventoryArgs[index];
    if (arg === "--scope") {
      scopes.push(
        normalizedScope(argumentValue(inventoryArgs, index, "--scope")),
      );
      index += 1;
      continue;
    }
    if (arg === "--denominator") {
      denominator = structuralDenominator(
        argumentValue(inventoryArgs, index, "--denominator"),
      );
      index += 1;
      continue;
    }
    throw new Error(`Unknown structural inventory argument: ${String(arg)}`);
  }
  return {
    denominator,
    scopes:
      scopes.length === 0 ? STRUCTURAL_PRODUCT_ROOTS : [...new Set(scopes)],
  };
};

export const pathIsInScopes = (
  file: string,
  scopes: readonly string[],
): boolean =>
  scopes.some((scope) => file === scope || file.startsWith(`${scope}/`));

export const structuralSliceForFile = (file: string): string => {
  const slice = STRUCTURAL_PRODUCT_SLICES.find(({ scopes }) =>
    pathIsInScopes(file, scopes),
  );
  if (slice === undefined)
    throw new Error(`Maintained product file has no structural slice: ${file}`);
  return slice.id;
};

export const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return item;
    return Object.fromEntries(
      Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
    );
  });

export const digestValue = (value: unknown): string =>
  createHash("sha256").update(stableJson(value)).digest("hex");
