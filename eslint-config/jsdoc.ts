// JSDoc rule family — one cohesive policy module for published-package
// exports. Kept out of eslint.config.ts so the lint policy hub stays a
// composition root instead of owning every family's rules.

import type { Linter } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";

// TypeScript-flavored recommended as a base, then re-tuned for "strict
// presence, zero tag overhead": a short contract block on published-package
// exports; no @param/@returns/@types (TS already carries those). Correctness
// rules (tag names, param names when tags exist) stay on.
const jsdocRecommendedTs = jsdoc.configs["flat/recommended-typescript"] as {
  readonly rules: Linter.RulesRecord;
};

// Presence: every published shared/ui export needs a short /** contract */.
// Param/return tags stay optional because TypeScript owns those shapes.
// enableFixer false — never inject bare @param tags via eslint --fix.
// publicOnly — file-private helpers free.
// apps/api and apps/web are outside this published-package contract.
export const jsdocConfig: Linter.Config = {
  files: ["packages/shared/src/**/*.ts", "packages/ui/src/**/*.{ts,tsx}"],
  plugins: { jsdoc },
  rules: {
    ...jsdocRecommendedTs.rules,
    "jsdoc/require-jsdoc": [
      "error",
      {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: true,
          FunctionExpression: true,
        },
        contexts: [
          "ExportNamedDeclaration > VariableDeclaration",
          "ExportNamedDeclaration > TSInterfaceDeclaration",
          "ExportNamedDeclaration > TSTypeAliasDeclaration",
          "ExportNamedDeclaration > TSEnumDeclaration",
        ],
        enableFixer: false,
      },
    ],
    "jsdoc/require-param": "off",
    "jsdoc/require-param-description": "off",
    "jsdoc/require-param-name": "off",
    "jsdoc/require-param-type": "off",
    "jsdoc/require-returns": "off",
    "jsdoc/require-returns-description": "off",
    "jsdoc/require-returns-type": "off",
    "jsdoc/require-returns-check": "off",
    "jsdoc/require-yields": "off",
    "jsdoc/require-yields-check": "off",
    "jsdoc/require-property": "off",
    "jsdoc/require-property-description": "off",
    "jsdoc/require-property-name": "off",
    "jsdoc/require-property-type": "off",
    "jsdoc/require-next-type": "off",
    "jsdoc/require-throws-type": "off",
    "jsdoc/check-param-names": [
      "error",
      { checkDestructured: false, enableFixer: false },
    ],
    "jsdoc/check-tag-names": "error",
    "jsdoc/check-alignment": "off",
    "jsdoc/multiline-blocks": "off",
    "jsdoc/escape-inline-tags": "off",
  },
};
