import { readFileSync } from "node:fs";

import { ESLint, Linter } from "eslint";

import { plantedScopeProbes } from "./eslint-policy-scope-cases.ts";
import { parseScopeLedger } from "./eslint-policy-scope-ledger-schema.ts";

interface EffectiveConfig {
  readonly languageOptions?: {
    readonly parserOptions?: Record<string, unknown>;
  };
  readonly plugins?: Linter.Config["plugins"];
  readonly rules?: Partial<Record<string, Linter.RuleEntry>>;
  readonly settings?: Linter.Config["settings"];
}

const ledger = parseScopeLedger(
  readFileSync("scripts/eslint/policy/eslint-policy-scope-ledger.json", "utf8"),
);
// Keep the config out of tsconfig.scripts' compilation graph: it deliberately
// carries plugin-local type shims that are checked by its own ESLint program.
const configModulePath = "../../../eslint.config.ts";
const configModule = (await import(configModulePath)) as {
  readonly default: readonly Linter.Config[];
};
const config = configModule.default;
const eslint = new ESLint({ cwd: process.cwd() });
const failures: string[] = [];
const effectiveConfig = async (
  path: string,
): Promise<EffectiveConfig | undefined> => {
  const result: unknown = await eslint.calculateConfigForFile(path);
  return result === undefined ? undefined : (result as EffectiveConfig);
};

const severity = (value: Linter.RuleEntry | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return "absent";
  if (raw === 0 || raw === "off") return "off";
  if (raw === 1 || raw === "warn") return "warn";
  return "error";
};

// Preserve the path's real parser, plugin, settings, and rule options, but run
// only the rule the planted snippet is designed to prove. Project-backed
// parsers otherwise combine the virtual snippet with the representative file's
// cached AST on Linux, and unrelated rules receive impossible source ranges.
const reportsProbeRule = async (
  code: string,
  path: string,
  rule: string,
): Promise<boolean> => {
  const effective = await effectiveConfig(path);
  const ruleEntry = effective?.rules?.[rule];
  if (severity(ruleEntry) === "absent" || severity(ruleEntry) === "off")
    return false;

  const parserOptions = effective?.languageOptions?.parserOptions ?? {};
  const {
    programs: _programs,
    project: _project,
    projectService: _projectService,
    ...syntaxParserOptions
  } = parserOptions;
  const isolatedConfig: Linter.Config = {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    ...(effective?.languageOptions === undefined
      ? {}
      : {
          languageOptions: {
            ...effective.languageOptions,
            parserOptions: {
              ...syntaxParserOptions,
              project: false,
              projectService: false,
            },
          },
        }),
    ...(effective?.plugins === undefined ? {} : { plugins: effective.plugins }),
    ...(effective?.settings === undefined
      ? {}
      : { settings: effective.settings }),
    rules: { [rule]: ruleEntry },
  };
  const probeLinter = new Linter({ configType: "flat" });
  return probeLinter
    .verify(code, [isolatedConfig], { filename: path })
    .some((message) => message.ruleId === rule);
};

const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return item;
    return Object.fromEntries(
      Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
    );
  });

const scopedConfigs = config.filter(
  (item): item is Linter.Config & { files: string[] } =>
    Array.isArray(item.files),
);
const scopedConfigIndexes = config.flatMap((item, index) =>
  Array.isArray(item.files) ? [index] : [],
);

if (ledger.entries.length !== ledger.startingSnapshot.overrideBlocks) {
  failures.push(
    `ledger count ${ledger.entries.length} != starting count ${ledger.startingSnapshot.overrideBlocks}`,
  );
}
if (scopedConfigs.length !== ledger.entries.length) {
  failures.push(
    `live scoped config count ${scopedConfigs.length} != ledger count ${ledger.entries.length}`,
  );
}
if (
  stable(scopedConfigIndexes) !==
  stable(
    ledger.entries
      .map((entry) => entry.configIndex)
      .toSorted((left, right) => left - right),
  )
) {
  failures.push(
    "scope ledger does not map every live scoped config exactly once",
  );
}

for (const entry of ledger.entries) {
  const source = config[entry.configIndex];
  if (source === undefined) {
    failures.push(`${entry.id}: config index ${entry.configIndex} is missing`);
    continue;
  }
  if (stable(source.files ?? []) !== stable(entry.files)) {
    failures.push(`${entry.id}: files selector drift`);
  }
  if (stable(source.ignores ?? []) !== stable(entry.ignores)) {
    failures.push(`${entry.id}: ignores selector drift`);
  }
  if (
    entry.classification === "duplicate" ||
    entry.classification === "relaxation debt"
  ) {
    failures.push(`${entry.id}: unresolved ${entry.classification}`);
  }
  if (entry.evidence.trim().length === 0) {
    failures.push(`${entry.id}: missing classification evidence`);
  }

  const positive = await effectiveConfig(entry.positive);
  const negative = await effectiveConfig(entry.negative);
  if (positive === undefined) {
    failures.push(`${entry.id}: positive representative is ignored`);
    continue;
  }
  if (entry.marker.kind === "parser-project") {
    const positiveOptions = positive.languageOptions?.parserOptions;
    const negativeOptions = negative?.languageOptions?.parserOptions;
    const projects = positiveOptions?.project;
    if (!Array.isArray(projects) || !projects.includes(entry.marker.positive)) {
      failures.push(`${entry.id}: positive parser project drift`);
    }
    if (negativeOptions?.projectService === undefined) {
      failures.push(`${entry.id}: negative no longer uses project service`);
    }
    continue;
  }
  const positiveValue = positive.rules?.[entry.marker.name];
  const negativeValue = negative?.rules?.[entry.marker.name];
  if (entry.marker.kind === "rule") {
    if (severity(positiveValue) !== entry.marker.positive) {
      failures.push(
        `${entry.id}: positive ${entry.marker.name} expected=${entry.marker.positive} actual=${severity(positiveValue)}`,
      );
    }
    if (severity(negativeValue) !== entry.marker.negative) {
      failures.push(
        `${entry.id}: negative ${entry.marker.name} expected=${entry.marker.negative} actual=${severity(negativeValue)}`,
      );
    }
    continue;
  }
  const positiveText = stable(positiveValue);
  const negativeText = stable(negativeValue);
  if (!positiveText.includes(entry.marker.positiveContains)) {
    failures.push(
      `${entry.id}: positive options lack ${entry.marker.positiveContains}`,
    );
  }
  if (negativeText.includes(entry.marker.negativeExcludes)) {
    failures.push(
      `${entry.id}: negative options leak ${entry.marker.negativeExcludes}`,
    );
  }
}

for (const probe of plantedScopeProbes) {
  for (const [side, path, expected] of [
    ["positive", probe.positive, probe.positiveReports],
    ["negative", probe.negative, probe.negativeReports],
  ] as const) {
    const reports = await reportsProbeRule(probe.code, path, probe.rule);
    if (reports !== expected) {
      failures.push(
        `${probe.id}: ${side} ${probe.rule} expectedReports=${expected} actual=${reports}`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`ESLint policy scope probes failed:\n${failures.join("\n")}`);
}

const counts = Map.groupBy(ledger.entries, (entry) => entry.classification);
process.stdout.write(
  `eslint-policy-scope-probes PASS blocks=${ledger.entries.length} ` +
    `enforcement=${counts.get("enforcement")?.length ?? 0} ` +
    `policy=${counts.get("policy")?.length ?? 0} ` +
    `specialization=${counts.get("specialization")?.length ?? 0} ` +
    `planted=${plantedScopeProbes.length * 2}\n`,
);
