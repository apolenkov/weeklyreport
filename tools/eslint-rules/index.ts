import type { ESLint } from "eslint";

import { noCommentArchaeology } from "./no-comment-archaeology.ts";
import { requireExportContract } from "./require-export-contract.ts";

// Local ESLint plugin: repo-specific rules that have no upstream equivalent.
export const localPlugin: ESLint.Plugin = {
  meta: { name: "local", version: "1.0.0" },
  rules: {
    "no-comment-archaeology": noCommentArchaeology,
    "require-export-contract": requireExportContract,
  },
};
