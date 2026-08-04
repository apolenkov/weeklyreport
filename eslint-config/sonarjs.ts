// SonarJS rule family — one cohesive policy module. Kept out of
// eslint.config.ts so the lint policy hub stays a composition root instead of
// one 1,200-line file owning every family's rule selection.

import type { Linter } from "eslint";
import sonarjs from "eslint-plugin-sonarjs";

// The recommended preset ships as a loose union; narrow it to the rules/settings
// shape we spread so the type-aware lint stays clean.
const sonarjsRecommendedConfig = sonarjs.configs?.recommended;
if (sonarjsRecommendedConfig === undefined) {
  throw new Error("eslint-plugin-sonarjs has no recommended configuration");
}
const sonarjsRecommended = sonarjsRecommendedConfig as unknown as {
  readonly rules: Linter.RulesRecord;
  readonly settings: NonNullable<Linter.Config["settings"]>;
};

// Cognitive-complexity budget: the hard standard's readability gate (see
// docs/exemplary-code-standard.md); cyclomatic `complexity` stays at 20.
const COGNITIVE_COMPLEXITY_MAX = 10;

// Full recommended ruleset enabled — every rule that fires ZERO times is
// enforced going forward (regression prevention). Rules that fire today split
// into PRUNE (permanently off, with reason) and the rest at error after each
// firing was fixed or per-site disabled with a reason.
export const sonarjsConfig: Linter.Config = {
  files: ["**/*.{ts,tsx,js,jsx,mjs}"],
  plugins: { sonarjs },
  settings: sonarjsRecommended.settings,
  rules: {
    ...sonarjsRecommended.rules,
    // — PRUNE (permanent off, with reason) —
    "sonarjs/todo-tag": "off", // fights the repo-mandated TODO(<ref>) deferred-feature convention (CLAUDE.md)
    "sonarjs/no-unused-vars": "off", // duplicate of unused-imports/no-unused-vars (already error)
    "sonarjs/deprecation": "off", // duplicate of @typescript-eslint/no-deprecated (already error)
    "sonarjs/prefer-read-only-props": "off", // aggressive React-prop-immutability churn (49 sites), suggestion-only, not standard practice
    "sonarjs/no-nested-conditional": "off", // nested ternaries are idiomatic in JSX rendering here (105 sites); cognitive-complexity already bounds nesting
    // — ENFORCED AT ERROR (with a reason where a firing survives) —
    // Behavior-sensitive hotspots (cognitive-complexity, no-nested-functions)
    // are cohesive single concerns where splitting below the threshold
    // fragments logic or breaks memoization; those files carry a permanent
    // exempt in the override blocks below rather than a rewrite. New code
    // stays gated.
    "sonarjs/cognitive-complexity": ["error", COGNITIVE_COMPLEXITY_MAX],
    "sonarjs/no-nested-functions": "error",
    // enforced in src (regression prevention); the only
    // current firings are fake fixtures (10.0.0.x IPs, fake passwords) in
    // test files, scoped off in the test-file override below.
    "sonarjs/no-hardcoded-ip": "error",
    "sonarjs/hardcoded-secret-signatures": "error",
    // The following are enforced at error. Behavior-sensitive rules (slow-
    // regex, no-alphabetical-sort, pseudo-random) are per-site-disabled with
    // reasons, NOT rewritten. Several also need a test-file carve-out (below)
    // where the firing is inherent to test code.
    "sonarjs/no-clear-text-protocols": "error", // src: jsonTransport false-positive disabled; tests carved out
    "sonarjs/no-alphabetical-sort": "error", // src: 4 stable-hash sorts per-site-disabled (determinism); tests carved out
    "sonarjs/slow-regex": "error", // 5 src: linear regexes per-site-disabled (incl. prod DB guard — NOT rewritten)
    "sonarjs/pseudo-random": "error", // 2 src: UI variety, per-site-disabled (not crypto)
    "sonarjs/no-os-command-from-path": "error", // 2 src: pnpm in dev reset script, per-site-disabled
    "sonarjs/os-command": "error", // 1 src: execSync → execFileSync (arg-array) in uat script
    "sonarjs/no-nested-template-literals": "error", // 5 src: const-lifted, output byte-identical
    "sonarjs/use-type-alias": "error", // src: extracted shared literal-union aliases; 1 Prisma shape disabled
    "sonarjs/no-misleading-array-reverse": "error", // src+test: copy-then-reverse where source unused
    "sonarjs/no-redundant-optional": "error", // test: dropped redundant `| undefined`
    "sonarjs/no-unused-collection": "error", // test: removed dead collection; 1 intentional disabled
    "sonarjs/public-static-readonly": "error", // test: added readonly modifier
    "sonarjs/no-invariant-returns": "error", // src: startOtel returns decision by design, per-site-disabled
    "sonarjs/reduce-initial-value": "error", // src: explicit editDates[0] seed (array always non-empty)
    "sonarjs/no-async-constructor": "error", // src: logger serial-write queue, per-site-disabled
    "sonarjs/function-return-type": "error", // src: Component.render override, per-site-disabled
    "sonarjs/void-use": "error", // src: dropped `void tz` for `_tz` unused-param convention
    // test-only firings; rule stays error in src, carved out in the test override below:
    "sonarjs/no-identical-functions": "error", // test: idiomatic render-wrapper duplication
    "sonarjs/no-undefined-argument": "error", // test: intentional undefined-arg legacy-contract checks
    // verified via the TS language server — `i.id`
    // (string | undefined) vs `record.sourceId` (string | null) overlap on
    // `string`, so the comparison is meaningful (match by id); the null/
    // undefined asymmetry is harmless. 2 sites per-site-disabled in
    // carry-over.service. NOT an always-false bug.
    "sonarjs/different-types-comparison": "error",
    // no-duplicate-string: the recommended preset ships this OFF; enabled
    // here so a string literal repeated 3+ times must be lifted to a shared
    // named constant. Tests are carved out below (repeated fixture strings
    // are inherent to test code).
    "sonarjs/no-duplicate-string": "error",
  },
};
