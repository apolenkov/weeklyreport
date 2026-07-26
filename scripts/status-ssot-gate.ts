#!/usr/bin/env node
// Status-SSOT re-declaration gate (status-type-ssot-gate spec): each vocabulary
// is declared once under packages/shared, and this fails any TS union type or
// zod literal list that re-declares one outside the allowlist below.
//
// It drives ESLint's Linter API instead of living in eslint.config.ts because
// that config already spends `no-restricted-syntax` on the `let` escape hatch,
// and it globally ignores the e2e and Prisma trees this gate must cover.
//
// Usage:
//   node scripts/status-ssot-gate.ts --all            # whole tree
//   node scripts/status-ssot-gate.ts <file> [file...] # given files
// (lint-staged passes staged files as args; --all is the `pnpm lint` sweep.)
import fs from "node:fs";
import path from "node:path";

import { Linter } from "eslint";
import tseslint from "typescript-eslint";

interface Vocabulary {
  readonly members: readonly string[];
  // `exact` distinguishes containment (extras are still the same vocabulary)
  // from set equality (a longer list is a different vocabulary).
  readonly exact: boolean;
  readonly message: string;
}

const VOCABULARIES: readonly Vocabulary[] = [
  {
    // Extras allowed: the three colors only ever come from the SSOT.
    members: ["green", "yellow", "red"],
    exact: false,
    message:
      "re-declares the TrafficLightStatus union — import it from @customreport/shared (report-primitives.schema.ts)",
  },
  {
    // Supersets such as draft|published|archived are distinct lifecycle
    // vocabularies by traced evidence and stay a review judgment.
    members: ["draft", "published"],
    exact: true,
    message:
      "re-declares the ReportStatus union — import it from @customreport/shared (report-primitives.schema.ts)",
  },
  {
    // Extras allowed; subsets such as the at-risk/blocked severity pair stay
    // legal, so containment is over all four members.
    members: ["blocked", "at-risk", "on-track", "empty"],
    exact: false,
    message:
      "re-declares the CanonicalStatus union — import it from @customreport/shared (canonical-status.ts, or the StageStatus alias)",
  },
  {
    // The role-type spec's own exemptions enumerate VALUES while typing from
    // shared, so they never form a four-member literal union.
    members: ["lead", "head", "admin", "viewer"],
    exact: false,
    message:
      "re-declares the Role/DbRole union — import it from @customreport/shared (schemas/auth.ts)",
  },
];

// The SSOT declarations themselves, plus the documented literal mirrors whose
// tsconfigs (prisma/, e2e/) cannot resolve @customreport/shared. Entries are
// repo-root-relative and matched by resolved path, so a same-named file
// elsewhere in the tree is NOT exempt.
const ALLOWLIST = [
  "packages/shared/src/schemas/report-primitives.schema.ts",
  "prisma/seed-constants.ts",
  // The canonical presentation vocabulary's single declaration
  // (status-presentation-model spec).
  "packages/shared/src/schemas/canonical-status.ts",
  // The role vocabulary's single declaration, both axes (role-type spec).
  "packages/shared/src/schemas/auth.ts",
  // e2e's isolated tsconfig cannot resolve @customreport/shared (no `paths`
  // mapping) — the role-type spec names "the e2e tree" as a self-contained
  // exemption from the re-declaration rule.
  "e2e/integration/fixtures.ts",
  "e2e/sweep/catalog-sweep.spec.ts",
  "e2e/sweep/helpers/dev-auth.ts",
];

// A vocabulary is re-declared as a TS union type or as a zod literal list.
// Array `as const` value lists are not type re-declarations and stay in
// neither shape, so they are out of scope by construction.
const DECLARATION =
  ':matches(TSUnionType, CallExpression[callee.object.name="z"][callee.property.name=/^(enum|union)$/])';

// Backtick members parse as TemplateElement, which `Literal[value=…]` misses.
const ANY_LITERAL = ":matches(Literal, TemplateElement)";
const contains = (member: string) =>
  `:has(:matches(Literal[value="${member}"], TemplateElement[value.cooked="${member}"]))`;
const isNot = (member: string) =>
  `:not([value="${member}"]):not([value.cooked="${member}"])`;
const nothingBut = (members: readonly string[]) =>
  `:not(:has(${ANY_LITERAL}${members.map(isNot).join("")}))`;

const selectorOf = (vocabulary: Vocabulary) =>
  DECLARATION +
  vocabulary.members.map(contains).join("") +
  (vocabulary.exact ? nothingBut(vocabulary.members) : "");

const linter = new Linter();

const LINT_CONFIG: Linter.Config = {
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: { parser: tseslint.parser },
  // No inline escape: an `eslint-disable` over a violation is inert, so a
  // carve-out has to be argued into ALLOWLIST above.
  linterOptions: { noInlineConfig: true },
  rules: {
    "no-restricted-syntax": [
      "error",
      ...VOCABULARIES.map((vocabulary) => ({
        selector: selectorOf(vocabulary),
        message: vocabulary.message,
      })),
    ],
  },
};

const IGNORE =
  /(^|\/)(node_modules|dist|\.git|\.turbo|\.next[^/]*|coverage|build|test-results|playwright-report|openspec\/changes\/archive)\//;
// Tests ARE covered (the gate is hollow otherwise) — only generated and
// vendored trees are skipped.
const isScannable = (file: string) =>
  /\.(ts|tsx)$/.test(file) && !/\.d\.ts$/.test(file) && !IGNORE.test(file);

// realpath both sides so symlinked segments (macOS /var -> /private/var, or a
// symlinked repo checkout) cannot make the same file compare unequal.
const realOrResolved = (target: string) => {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
};

const isAllowlisted = (file: string) => {
  const resolved = realOrResolved(file);
  return ALLOWLIST.some((entry) => resolved === realOrResolved(entry));
};

const walk = (dir: string): readonly string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    if (IGNORE.test(`${child}/`)) return [];
    return entry.isDirectory() ? walk(child) : [child];
  });

// A file the gate did not actually judge fails loudly rather than passing as
// "no hits": `fatal` is a parse failure, and a message with no source position
// (line 0) is ESLint reporting that it never linted the file at all.
const isVerdict = (message: Linter.LintMessage) =>
  message.fatal === true ||
  message.line === 0 ||
  message.ruleId === "no-restricted-syntax";

const describe = (message: Linter.LintMessage) => {
  const detail = message.fatal
    ? `unparseable — ${message.message}`
    : message.message;
  return `  ${message.line}: ${detail}`;
};

// ESLint only lints paths under its base path, so the name it is given is
// realpath'd: a symlinked segment would otherwise skip the file silently.
const scanFile = (file: string) =>
  linter
    .verify(fs.readFileSync(file, "utf8"), LINT_CONFIG, realOrResolved(file))
    .filter(isVerdict)
    .map(describe);

const all = process.argv.includes("--all");
const argPaths = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const files = (all ? walk(".") : argPaths).filter(
  (file) => isScannable(file) && !isAllowlisted(file),
);

const perFile = new Map<string, readonly string[]>(
  files
    .map((file) => [file, scanFile(file)] as const)
    .filter(([, hits]) => hits.length > 0),
);

const total = [...perFile.values()].reduce(
  (count, hits) => count + hits.length,
  0,
);
for (const [file, hits] of perFile)
  console.log(`\n${file}\n${hits.join("\n")}`);
console.log(
  `\n${total} status literal-union hit(s) in ${perFile.size} file(s).`,
);
process.exit(total ? 1 : 0);
