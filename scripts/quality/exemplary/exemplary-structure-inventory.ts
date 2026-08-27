import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { ESLint } from "eslint";

import { readSuppressionInventory } from "../../eslint/suppression/eslint-suppression-inventory.ts";
import { classifyExemplaryFileRole } from "./exemplary-file-kind.ts";
import {
  digestValue,
  pathIsInScopes,
  stableJson,
  strictStructuralRuleGaps,
  STRUCTURAL_PRODUCT_ROOTS,
  STRUCTURAL_PRODUCT_SLICES,
  STRUCTURAL_RULE_CONFIG,
  STRUCTURAL_RULE_IDS,
  type StructuralInventoryOptions,
  type StructuralRuleId,
  structuralRuleIsGap,
  structuralSliceForFile,
  TRANSITIONAL_STRUCTURAL_LIMITS,
} from "./exemplary-structure-contract.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const GIT_BIN = "/usr/bin/git";
const TYPESCRIPT_SOURCE = /\.[cm]?[jt]sx?$/u;
const STRUCTURAL_RULE_SET = new Set<string>(STRUCTURAL_RULE_IDS);

interface CalculatedConfig {
  readonly rules?: Partial<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const calculatedConfig = async (
  eslint: ESLint,
  file: string,
): Promise<CalculatedConfig | undefined> => {
  const value: unknown = await eslint.calculateConfigForFile(file);
  if (!isRecord(value)) return undefined;
  const rules = value.rules;
  return isRecord(rules) ? { rules } : {};
};

const git = (args: readonly string[]): string =>
  execFileSync(GIT_BIN, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: Number.MAX_SAFE_INTEGER,
  });

const splitNull = (value: string): readonly string[] =>
  value.split("\0").filter((entry) => entry !== "");

const candidateFiles = (): readonly string[] =>
  splitNull(
    git([
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...STRUCTURAL_PRODUCT_ROOTS,
    ]),
  )
    .filter((file) => TYPESCRIPT_SOURCE.test(file))
    .filter((file) => existsSync(`${REPO_ROOT}${file}`))
    .toSorted((left, right) => left.localeCompare(right));

export const selectStructuralFiles = (
  files: readonly string[],
  options: StructuralInventoryOptions,
): readonly string[] =>
  files.filter(
    (file) =>
      pathIsInScopes(file, options.scopes) &&
      (options.denominator === "all-source" ||
        classifyExemplaryFileRole(file).structuralScope ===
          "maintained-product"),
  );

export interface StructuralFinding {
  readonly file: string;
  readonly ruleId: StructuralRuleId;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

interface RuleSummary {
  readonly occurrences: number;
  readonly fileCount: number;
  readonly files: readonly string[];
}

export const summarizeStructuralFindings = (
  findings: readonly StructuralFinding[],
): Readonly<Record<StructuralRuleId, RuleSummary>> => {
  const summarize = (ruleId: StructuralRuleId): RuleSummary => {
    const matches = findings.filter((finding) => finding.ruleId === ruleId);
    const files = [...new Set(matches.map((finding) => finding.file))].toSorted(
      (left, right) => left.localeCompare(right),
    );
    return { occurrences: matches.length, fileCount: files.length, files };
  };
  return {
    "max-lines": summarize("max-lines"),
    "max-lines-per-function": summarize("max-lines-per-function"),
    complexity: summarize("complexity"),
    "sonarjs/cognitive-complexity": summarize("sonarjs/cognitive-complexity"),
  };
};

const sourceIdentity = (scopes: readonly string[]) => {
  const status = git([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...scopes,
  ]).trim();
  return {
    branch: git(["branch", "--show-current"]).trim(),
    sha: git(["rev-parse", "HEAD"]).trim(),
    tree: git(["rev-parse", "HEAD^{tree}"]).trim(),
    binding: status === "" ? ("HEAD" as const) : ("WORKTREE" as const),
    inScopeDirty: status !== "",
  };
};

const effectiveConfigGroups = async (
  eslint: ESLint,
  files: readonly string[],
) => {
  const groups = new Map<
    string,
    { readonly config: unknown; readonly files: string[] }
  >();
  for (const file of files) {
    const config = await calculatedConfig(eslint, file);
    const structuralConfig = Object.fromEntries(
      STRUCTURAL_RULE_IDS.map((ruleId) => [ruleId, config?.rules?.[ruleId]]),
    );
    const key = stableJson(structuralConfig);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { config: structuralConfig, files: [file] });
    } else {
      existing.files.push(file);
    }
  }
  return [...groups.values()].map(({ config, files: groupFiles }) => ({
    config,
    configDigest: digestValue(config),
    fileCount: groupFiles.length,
    fileDigest: digestValue(groupFiles),
    representative: groupFiles[0] ?? null,
  }));
};

const broadStructuralSuppressions = (files: readonly string[]) =>
  files.flatMap((file) => {
    const source = readFileSync(`${REPO_ROOT}${file}`, "utf8");
    return [
      ...source.matchAll(/eslint-disable(?:-next-line|-line)?\s*(?:--|$)/gmu),
    ].map((match) => ({
      file,
      line: source.slice(0, match.index).split("\n").length,
      rule: "all",
    }));
  });

const structuralSuppressionInventory = async (
  eslint: ESLint,
  files: readonly string[],
) => {
  const explicit = readSuppressionInventory(files)
    .directives.filter((directive) => STRUCTURAL_RULE_SET.has(directive.rule))
    .map(({ path: file, line, rule }) => ({ file, line, rule }));
  const inline = [...explicit, ...broadStructuralSuppressions(files)].toSorted(
    (left, right) =>
      `${left.file}:${left.line}:${left.rule}`.localeCompare(
        `${right.file}:${right.line}:${right.rule}`,
      ),
  );
  const weakenedFiles: { file: string; rules: StructuralRuleId[] }[] = [];
  const notStrictBySlice = Object.fromEntries(
    STRUCTURAL_PRODUCT_SLICES.map(({ id }) => [id, 0]),
  ) as Record<string, number>;
  let notStrictFileCount = 0;
  for (const file of files) {
    const config = await calculatedConfig(eslint, file);
    const rules = STRUCTURAL_RULE_IDS.filter((ruleId) => {
      const entry = config?.rules?.[ruleId];
      return structuralRuleIsGap(entry, TRANSITIONAL_STRUCTURAL_LIMITS[ruleId]);
    });
    if (rules.length > 0) weakenedFiles.push({ file, rules });
    if (strictStructuralRuleGaps(config?.rules).length > 0) {
      const slice = structuralSliceForFile(file);
      notStrictBySlice[slice] = (notStrictBySlice[slice] ?? 0) + 1;
      notStrictFileCount += 1;
    }
  }
  return {
    inline,
    inlineCount: inline.length,
    perFileWeakenings: weakenedFiles,
    perFileWeakeningCount: weakenedFiles.length,
    strictEnforcement: {
      strictFileCount: files.length - notStrictFileCount,
      notStrictFileCount,
      notStrictBySlice,
    },
  };
};

export const measureStructuralInventory = async (
  options: StructuralInventoryOptions,
) => {
  const files = selectStructuralFiles(candidateFiles(), options);
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    ruleFilter: ({ ruleId }) => STRUCTURAL_RULE_SET.has(ruleId),
    warnIgnored: false,
  });
  const results = files.length === 0 ? [] : await eslint.lintFiles([...files]);
  const findings = results
    .flatMap((result) =>
      result.messages.flatMap((message) => {
        const relativeFile = result.filePath.replace(REPO_ROOT, "");
        return message.ruleId !== null &&
          STRUCTURAL_RULE_SET.has(message.ruleId)
          ? [
              {
                file: relativeFile,
                ruleId: message.ruleId as StructuralRuleId,
                line: message.line,
                column: message.column,
                message: message.message,
              },
            ]
          : [];
      }),
    )
    .toSorted((left, right) =>
      `${left.file}:${left.line}:${left.column}:${left.ruleId}`.localeCompare(
        `${right.file}:${right.line}:${right.column}:${right.ruleId}`,
      ),
    );
  const affectedFiles = [...new Set(findings.map((finding) => finding.file))];
  const roleCounts = Object.fromEntries(
    [...Map.groupBy(files, (file) => classifyExemplaryFileRole(file).id)].map(
      ([role, roleFiles]) => [role, roleFiles.length],
    ),
  );
  const effectiveConfigs = await effectiveConfigGroups(eslint, files);
  const suppressions = await structuralSuppressionInventory(eslint, files);
  return {
    schemaVersion: 1,
    source: sourceIdentity(options.scopes),
    denominator: {
      kind: options.denominator,
      scopes: options.scopes,
      fileCount: files.length,
      fileDigest: digestValue(files),
      contentDigest: digestValue(
        files.map((file) => [
          file,
          readFileSync(`${REPO_ROOT}${file}`, "utf8"),
        ]),
      ),
      roleCounts,
    },
    candidate: {
      rules:
        effectiveConfigs.length === 1
          ? effectiveConfigs[0]?.config
          : STRUCTURAL_RULE_CONFIG,
      findings,
      findingCount: findings.length,
      fileCount: affectedFiles.length,
      files: affectedFiles,
      byRule: summarizeStructuralFindings(findings),
      toolExit: findings.length === 0 ? 0 : 1,
    },
    effectiveConfigGroups: effectiveConfigs,
    suppressions,
    classification:
      options.denominator === "all-source"
        ? "REJECTED_SCOPE_CONTROL"
        : suppressions.strictEnforcement.notStrictFileCount === 0
          ? "NOT_PROVEN"
          : "CONFIG",
  };
};
