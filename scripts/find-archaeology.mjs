#!/usr/bin/env node
// Comment-archaeology detector. Flags change-history / ticket / phase refs in
// comments — the stuff CLAUDE.md bans ("no archaeology"; git history holds that).
//
// Usage:
//   node scripts/find-archaeology.mjs --all           # scan the whole tree
//   node scripts/find-archaeology.mjs <file> [file...] # scan given files
// (lint-staged passes staged files as args; --all is the manual full sweep.)
// Exits 1 if any hit is found, so it can gate a commit.
import fs from "node:fs";
import path from "node:path";

const ALL = process.argv.includes("--all");
const argPaths = process.argv.slice(2).filter((a) => !a.startsWith("--"));

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
const ticketSlug = (comment) => {
  // Walk every slug on the line — a leading standard token (RFC-5322, ISO-8601)
  // must not hide a later real ticket slug on the same comment.
  // {1,5}: single-letter prefixes count too — this repo's ledgers mint
  // one-letter row ids that leak into comments and test titles.
  for (const m of comment.matchAll(/\b([A-Z]{1,5})-\d{1,4}\b/g)) {
    if (!STANDARDS.has(m[1].toUpperCase())) return true;
  }
  return false;
};

// Each rule is a high-precision pattern that essentially never appears in a
// legitimate comment, so a match is almost certainly archaeology, plus a label.
// A rule is either a RegExp or a (comment) => boolean predicate.
const RULES = [
  [ticketSlug, "ticket-slug (e.g. UFB-036, AUTH-08, SC-160)"],
  [/\bR\d+[a-z]?-\d+\b/, "plan-slug (e.g. R3a-4)"],
  [/\b(Phase|Plan)\s+\d+\b/i, "phase/plan ref"],
  [/\bUAT-v\d+\b/, "uat ref"],
  [/\bSynthesis notes\b/i, "synthesis-notes header"],
  [/\bPITFALLS?\b.*\bPitfall\b/i, "pitfalls doc ref"],
  [/\bdesign D\d+\b/i, "design-doc ref"],
  [
    /\b(moved|relocated|extracted|graduated|dissolved|renamed|migrated)\b[^.\n]{0,40}\b(into|from|out of|to|by|verbatim)\b/i,
    "change-history narration (moved/extracted/... into/from/by)",
  ],
  [/\b\w+ dissolve\b/i, "dissolve narration"],
  [/\bmax-lines split\b/i, "split narration"],
];

// Judge only comment text. Return the comment slice of a line, or null.
// Skip `//` that sits inside a string literal so a URL like
// `const u = "https://host/a//x"` is never scanned as a comment.
const QUOTE_TOGGLES = [
  ["'", (s) => !s.inDouble && !s.inTemplate, "inSingle"],
  ['"', (s) => !s.inSingle && !s.inTemplate, "inDouble"],
  ["`", (s) => !s.inSingle && !s.inDouble, "inTemplate"],
];

const outsideStrings = (s) => !s.inSingle && !s.inDouble && !s.inTemplate;

const stepQuoteState = (state, c) => {
  if (state.escaped) return { ...state, escaped: false };
  if (!outsideStrings(state) && c === "\\") return { ...state, escaped: true };
  const toggle = QUOTE_TOGGLES.find(
    ([quote, canToggle]) => c === quote && canToggle(state),
  );
  if (!toggle) return state;
  return { ...state, [toggle[2]]: !state[toggle[2]] };
};

const commentPart = (line) => {
  let state = {
    inSingle: false,
    inDouble: false,
    inTemplate: false,
    escaped: false,
  };
  for (let i = 0; i < line.length - 1; i++) {
    const opensComment =
      outsideStrings(state) &&
      !state.escaped &&
      line[i] === "/" &&
      line[i + 1] === "/";
    if (opensComment) return line.slice(i);
    state = stepQuoteState(state, line[i]);
  }
  if (/^\s*\*/.test(line) || /\/\*/.test(line)) return line;
  return null;
};

// Test titles are string-literal arguments to describe/it/test (and their
// .only/.skip/.each/x*/f* variants) — the one string-literal shape archaeology
// reliably hides in, since it renders in the reporter output the way a
// comment never does. Grabs the first quoted literal on the call line.
// The .each curried form puts the title in a SECOND call — same-line
// `it.each(tbl)("title", …)` or, after a multi-line table, a continuation
// line shaped `])("title", …)` — so those two shapes get their own patterns.
const TEST_TITLE_PATTERNS = [
  /\b[xf]?(?:describe|it|test|context)(?:\.\w+)*\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/,
  /\b[xf]?(?:describe|it|test)\.each\s*\([^)]*\)\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/,
  /^[\s\]}]*\)\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/,
];
const testTitlePart = (line) => {
  for (const pattern of TEST_TITLE_PATTERNS) {
    const m = line.match(pattern);
    if (m) return m[2];
  }
  return null;
};

// .claude/ holds orchestration scripts whose "Phase N" labels are live
// structure, not change-log narration.
const IGNORE =
  /(^|\/)(node_modules|dist|\.next[^/]*|coverage|openspec\/changes\/archive|\.claude)\//;
const isTestSource = (f) => /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f);
const isScannable = (f) =>
  /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) &&
  !/(^|\/)(e2e|__mocks__)\//.test(f) &&
  !IGNORE.test(f);

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (IGNORE.test(`${p}/`)) return [];
    return e.isDirectory() ? walk(p) : [p];
  });

const files = ALL
  ? ["apps", "packages", "prisma"]
      .filter((d) => fs.existsSync(d))
      .flatMap(walk)
      .filter(isScannable)
  : argPaths.filter(isScannable);

const firstMatch = (text) => {
  for (const [rule, label] of RULES) {
    const hit = typeof rule === "function" ? rule(text) : rule.test(text);
    if (hit) return label;
  }
  return null;
};

const perFile = new Map();
for (const f of files) {
  const hits = [];
  const testSource = isTestSource(f);
  fs.readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const comment = commentPart(line);
      const commentLabel = comment && firstMatch(comment);
      if (commentLabel)
        hits.push(`  ${i + 1}: [${commentLabel}] ${line.trim().slice(0, 100)}`);
      if (!testSource) return;
      const title = testTitlePart(line);
      const titleLabel = title && firstMatch(title);
      if (titleLabel)
        hits.push(
          `  ${i + 1}: [${titleLabel} in test title] ${line.trim().slice(0, 100)}`,
        );
    });
  if (hits.length) perFile.set(f, hits);
}

const total = [...perFile.values()].reduce((n, h) => n + h.length, 0);
for (const [f, hits] of perFile) console.log(`\n${f}\n${hits.join("\n")}`);
console.log(`\n${total} archaeology hit(s) in ${perFile.size} file(s).`);
process.exit(total ? 1 : 0);
