// SonarJS rule family — one cohesive policy module. Kept out of
// eslint.config.ts so the lint policy hub stays a composition root instead of
// owning every family's rule selection.

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

// Full recommended ruleset enabled. Intentional exceptions are documented at
// their rule entry or at the affected call site.
export const sonarjsConfig: Linter.Config = {
  files: ["**/*.{ts,tsx,js,jsx,mjs}"],
  plugins: { sonarjs },
  settings: sonarjsRecommended.settings,
  rules: {
    ...sonarjsRecommended.rules,
    // Rules intentionally delegated to a more specific lint rule or unsuitable
    // for this codebase remain explicitly disabled.
    "sonarjs/todo-tag": "off",
    "sonarjs/no-unused-vars": "off", // covered by the TypeScript unused-import rule
    "sonarjs/deprecation": "off", // covered by the TypeScript deprecation rule
    "sonarjs/prefer-read-only-props": "off", // suggestion-only React prop immutability is not part of the project contract
    "sonarjs/no-nested-conditional": "off", // nested ternaries are idiomatic in JSX rendering; cognitive complexity bounds nesting
    // Complexity stays bounded for all production code.
    "sonarjs/cognitive-complexity": ["error", COGNITIVE_COMPLEXITY_MAX],
    "sonarjs/no-nested-functions": "error",
    // Test fixtures contain synthetic IPs and secrets; the test-file override
    // scopes those values away from this production rule.
    "sonarjs/no-hardcoded-ip": "error",
    "sonarjs/hardcoded-secret-signatures": "error",
    // Behavior-sensitive rules remain enforced; intentional exceptions are
    // documented at the call site; test-only cases use the test override.
    "sonarjs/no-clear-text-protocols": "error",
    "sonarjs/no-alphabetical-sort": "error",
    "sonarjs/slow-regex": "error",
    "sonarjs/pseudo-random": "error",
    "sonarjs/no-os-command-from-path": "error",
    "sonarjs/os-command": "error", // require argument-array process calls instead of shell command construction
    "sonarjs/no-nested-template-literals": "error",
    "sonarjs/use-type-alias": "error",
    "sonarjs/no-misleading-array-reverse": "error",
    "sonarjs/no-redundant-optional": "error",
    "sonarjs/no-unused-collection": "error",
    "sonarjs/public-static-readonly": "error",
    "sonarjs/no-invariant-returns": "error",
    "sonarjs/reduce-initial-value": "error",
    "sonarjs/no-async-constructor": "error",
    "sonarjs/function-return-type": "error",
    "sonarjs/void-use": "error",
    // Test fixtures use deliberate duplication and undefined-input boundaries;
    // production code remains subject to these rules.
    "sonarjs/no-identical-functions": "error", // test: idiomatic render-wrapper duplication
    "sonarjs/no-undefined-argument": "error", // test fixtures exercise intentional undefined-input boundaries
    "sonarjs/different-types-comparison": "error",
    // no-duplicate-string: the recommended preset ships this OFF; enabled
    // here so a string literal repeated 3+ times must be lifted to a shared
    // named constant. Test fixtures use their own scoped configuration.
    "sonarjs/no-duplicate-string": "error",
  },
};
