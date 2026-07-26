import type { Rule } from "eslint";

// Standards/protocol tokens that look like a ticket slug but are not history:
// ISO-8601, UTF-8, SHA-256, RFC-5322, HTTP-2, TLS-1, etc. Never flag these.
const STANDARDS = new Set([
  "ISO",
  "UTF",
  "SHA",
  "RFC",
  "HTTP",
  "HTTPS",
  "MD",
  "AES",
  "RSA",
  "EC",
  "TLS",
  "SSL",
  "ES",
  "IP",
  "IPV",
  "W3C",
  "HMAC",
  "CRC",
  "UTC",
  "GMT",
  "BASE",
  // Time-offset notation ("the T-24h tick", "T-0"), not a ticket slug.
  "T",
  // Relative-period notation in seeds/tests ("week N-1", "history N-2").
  "N",
  // Durable spec-decision anchors ("per D-6") — load-bearing rationale, not
  // change-log archaeology.
  "D",
]);

const SLUG = /\b([A-Z]{1,5})-\d{1,4}\b/g;

const hasTicketSlug = (text: string): boolean =>
  // Every slug on the line: a leading standard token (RFC-5322) must not hide
  // a real one later in the same text. `{1,5}` because this repo's ledgers
  // mint one-letter row ids that leak into comments and test titles.
  [...text.matchAll(SLUG)].some(
    (match) => !STANDARDS.has((match[1] ?? "").toUpperCase()),
  );

type Detector = RegExp | ((text: string) => boolean);

// Patterns that essentially never appear in a legitimate comment; the first
// match names the hit. Precision is the contract and recall is spent for it —
// a rule that fires on honest comments gets disabled, and then catches nothing.
const DETECTORS: readonly (readonly [Detector, string])[] = [
  [hasTicketSlug, "ticket-slug (e.g. UFB-036, AUTH-08, SC-160)"],
  [/\bR\d+[a-z]?-\d+\b/, "plan-slug (e.g. R3a-4)"],
  [/\b(Phase|Plan)\s+\d+\b/i, "phase/plan ref"],
  [/\bUAT-v\d+\b/, "uat ref"],
  [/\bSynthesis notes\b/i, "synthesis-notes header"],
  [/\bPITFALLS?\b.*\bPitfall\b/i, "pitfalls doc ref"],
  [/\bdesign D\d+\b/i, "design-doc ref"],
  // `into` / `out of` name a destination, which only a code unit has.
  [
    /\b(moved|relocated|extracted|graduated|dissolved|renamed|migrated)\b[^.\n]{0,40}\b(into|out of|verbatim)\b/i,
    "change-history narration (moved/extracted/... into/out of)",
  ],
  // `from` / `to` / `by` also read as plain data flow, so `extracted` is out
  // of this arm — "extracted from the Authorization header" is honest.
  [
    /\b(moved|relocated|graduated|dissolved|renamed|migrated)\b[^.\n]{0,40}\b(from|to|by)\b/i,
    "change-history narration (moved/migrated/... from/to/by)",
  ],
  // Only verbs with no data sense. A URL is rewritten by a proxy and a token
  // is extracted from a header, so those two belong to review, not here.
  [
    /\b(refactored|reworked|reimplemented)\b/i,
    "change-history narration (refactored/reworked/reimplemented)",
  ],
  // `previously` must point at the code (`previously this …`): on its own it
  // describes a row's lifecycle far more often than a commit in this domain.
  [
    /\bformerly\b|\bpreviously\s+this\b/i,
    "prior-state narration (formerly/previously this)",
  ],
  [/\b\w+ dissolve\b/i, "dissolve narration"],
  [/\bmax-lines split\b/i, "split narration"],
];

const firstLabel = (text: string): string | null => {
  const hit = DETECTORS.find(([detector]) =>
    typeof detector === "function" ? detector(text) : detector.test(text),
  );
  return hit ? hit[1] : null;
};

type CallNode = Parameters<NonNullable<Rule.NodeListener["CallExpression"]>>[0];
type Callee = CallNode["callee"];
type Argument = CallNode["arguments"][number];

// Test titles are the one non-comment place archaeology reliably hides: they
// render in reporter output the way a comment never does.
const TEST_FUNCTION = /^[xf]?(?:describe|it|test|context)$/;

// Resolves `it`, `it.only`, `describe.each(table)` and deeper chains to the
// name they start from; anything else (a method on an object, `super()`) to null.
const rootCalleeName = (callee: Callee): string | null => {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression") return rootCalleeName(callee.object);
  if (callee.type === "CallExpression") return rootCalleeName(callee.callee);
  return null;
};

const isTestCall = (node: CallNode): boolean => {
  const name = rootCalleeName(node.callee);
  return name !== null && TEST_FUNCTION.test(name);
};

// Archaeology hides in an interpolated title's literal halves too. Joining the
// quasis on a space keeps each static run intact while stopping a slug from
// being forged across an interpolation boundary.
const staticString = (argument: Argument): string | null => {
  if (argument.type === "Literal")
    return typeof argument.value === "string" ? argument.value : null;
  if (argument.type === "TemplateLiteral")
    return argument.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ");
  return null;
};

export const noCommentArchaeology: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban change-log, ticket and phase references in comments and test titles",
    },
    schema: [],
    messages: {
      comment:
        "Comment archaeology: {{label}}. Git history holds this — state the current WHY or delete the line.",
      testTitle:
        "Archaeology in a test title: {{label}}. Name the behavior under test, not its history.",
    },
  },
  create(context) {
    // One report per comment line, mirroring how the text is read and keeping
    // the location on the offending line of a block comment.
    const checkComment = (comment: {
      readonly value: string;
      readonly loc?: {
        readonly start: { line: number; column: number };
      } | null;
    }): void => {
      const start = comment.loc?.start ?? { line: 1, column: 0 };
      for (const [index, text] of comment.value.split("\n").entries()) {
        const label = firstLabel(text);
        if (label === null) continue;
        context.report({
          loc: {
            line: start.line + index,
            column: index === 0 ? start.column : 0,
          },
          messageId: "comment",
          data: { label },
        });
      }
    };

    const checkTestTitle = (node: CallNode): void => {
      const [first] = node.arguments;
      if (first === undefined || !isTestCall(node)) return;
      const title = staticString(first);
      const label = title === null ? null : firstLabel(title);
      if (label === null) return;
      context.report({ node: first, messageId: "testTitle", data: { label } });
    };

    return {
      Program: () => {
        for (const comment of context.sourceCode.getAllComments())
          checkComment(comment);
      },
      CallExpression: checkTestTitle,
    };
  },
};
