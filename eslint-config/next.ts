// Next-specific correctness rules — one cohesive policy module. Kept out of
// eslint.config.ts so the lint policy hub stays a composition root instead of
// one 1,200-line file owning every family's rule selection.

import nextPlugin from "@next/eslint-plugin-next";
import type { Linter } from "eslint";

// Next 16 removed `next lint`, so the plugin must be wired manually or these
// rules simply never run. The core-web-vitals preset layers the CWV-relevant
// promotions on top of recommended; preset severities kept as shipped.
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
