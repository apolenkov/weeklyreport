import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import { noCommentArchaeology } from "./no-comment-archaeology.ts";

// RuleTester drives whatever test framework it is handed; vitest is not
// auto-detected.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

// Slugs are assembled at runtime so this file never carries a literal slug of
// its own — the fixtures are data, not references to real work.
const slug = (letters: string, digits: string): string =>
  `${letters}-${digits}`;

// Same reason as `slug`: a fixture that needs to LOOK interpolated must not be
// a literal `${…}` inside a plain string, which the repo bans.
const interpolation = (name: string): string => `$\{${name}}`;

const TICKET = `ticket-slug (e.g. ${slug("UFB", "036")}, ${slug("AUTH", "08")}, ${slug("SC", "160")})`;
const NARRATION = "change-history narration (moved/extracted/... into/from/by)";

ruleTester.run("no-comment-archaeology", noCommentArchaeology, {
  valid: [
    "// This guard keeps published reports immutable.",
    // The case the STANDARDS set exists for.
    "// Addresses follow RFC-5322: https://www.rfc-editor.org/rfc/RFC-5322",
    "// Timestamps are ISO-8601; digests use SHA-256; payloads are UTF-8.",
    "// The T-24h tick compares week N-1 against the anchor from D-6.",
    // A ticket-looking string in ordinary code is data, not a reference.
    `const ref = "${slug("UFB", "036")} rollout";`,
    `logger.warn("${slug("AUTH", "08")}");`,
    // A non-test call with a string first argument is not a test title.
    `format("${slug("SC", "160")} regression");`,
    // Interpolation must not forge a slug across the boundary, and an
    // interpolated title that carries no archaeology stays legal.
    `it(\`renders ${interpolation("role")} without a banner\`, () => {});`,
    `it(\`RFC-5322 parsing for ${interpolation("role")}\`, () => {});`,
  ],
  invalid: [
    {
      code: `// ${slug("UFB", "036")} tightened the publish guard.`,
      errors: [{ messageId: "comment", data: { label: TICKET } }],
    },
    {
      code: `// ${slug("AUTH", "08")} and ${slug("SC", "160")} landed together.`,
      errors: [{ messageId: "comment", line: 1 }],
    },
    {
      code: "// R3a-4 plan step is done.",
      errors: [
        { messageId: "comment", data: { label: "plan-slug (e.g. R3a-4)" } },
      ],
    },
    {
      code: "// Phase 35-08 cleanup.",
      errors: [{ messageId: "comment", data: { label: "phase/plan ref" } }],
    },
    {
      code: "// Extracted the row builder into this module.",
      errors: [{ messageId: "comment", data: { label: NARRATION } }],
    },
    {
      // Block comments are judged line by line, so the report lands on the
      // offending line and `Phase\n 3` cannot match across the newline.
      code: `/*\n * Clean first line.\n * ${slug("FIX", "02")} rewired the gate.\n */`,
      errors: [{ messageId: "comment", line: 3, column: 1 }],
    },
    {
      code: `it("${slug("UFB", "036")}: keeps the gate closed", () => {});`,
      errors: [{ messageId: "testTitle", data: { label: TICKET } }],
    },
    {
      code: `describe.only("${slug("SC", "160")} regression", () => {});`,
      errors: [{ messageId: "testTitle" }],
    },
    {
      code: `xtest.each([[1]])("${slug("AUTH", "08")} case %i", () => {});`,
      errors: [{ messageId: "testTitle" }],
    },
    {
      // The curried `.each` form with a multi-line table: one AST shape, where
      // the line-based detector needed a bespoke continuation-line pattern.
      code: `it.each([\n  [1],\n  [2],\n])("${slug("AUTH", "08")} case %i", () => {});`,
      errors: [{ messageId: "testTitle", line: 4 }],
    },
    {
      code: "it(`Phase 35-08 rollout`, () => {});",
      errors: [{ messageId: "testTitle", data: { label: "phase/plan ref" } }],
    },
    {
      // Interpolated titles are the shape actually used in this repo, and a
      // slug hides in the static half just as well as in a plain string.
      code: `it(\`${slug("UFB", "036")}: \${role} cannot publish\`, () => {});`,
      errors: [{ messageId: "testTitle", data: { label: TICKET } }],
    },
  ],
});
