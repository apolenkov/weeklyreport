// Next-specific correctness rules — one cohesive policy module. Kept out of
// eslint.config.ts so the lint policy hub stays a composition root instead of
// one 1,200-line file owning every family's rule selection.

import nextPlugin from "@next/eslint-plugin-next";
import type { Linter } from "eslint";

// The plugin is wired directly for the App Router; core-web-vitals adds the
// performance-focused rules to the recommended set.
export const nextConfig: Linter.Config = {
  files: ["apps/web/**/*.{ts,tsx}"],
  plugins: { "@next/next": nextPlugin },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    // Pages-Router-only rule; this app is App Router and the rule errors
    // ("Pages directory cannot be found") when eslint runs from the repo root.
    "@next/next/no-html-link-for-pages": "off",
  },
};
