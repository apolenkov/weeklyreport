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
]);
const ticketSlug = (comment) => {
  const m = comment.match(/\b([A-Z]{2,5})-\d{1,4}\b/);
  return m ? !STANDARDS.has(m[1].toUpperCase()) : false;
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
const commentPart = (line) => {
  const s = line.indexOf("//");
  if (s >= 0) return line.slice(s);
  if (/^\s*\*/.test(line) || /\/\*/.test(line)) return line;
  return null;
};

const IGNORE =
  /(^|\/)(node_modules|dist|\.next|\.next-verify|coverage|openspec\/changes\/archive)\//;
const isProdSource = (f) =>
  /\.(ts|tsx)$/.test(f) &&
  !/\.(test|spec)\.[tj]sx?$/.test(f) &&
  !/(^|\/)(e2e|__tests__|__mocks__)\//.test(f) &&
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
      .filter(isProdSource)
  : argPaths.filter(isProdSource);

const firstMatch = (comment) => {
  for (const [rule, label] of RULES) {
    const hit = typeof rule === "function" ? rule(comment) : rule.test(comment);
    if (hit) return label;
  }
  return null;
};

const perFile = new Map();
for (const f of files) {
  const hits = [];
  fs.readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const comment = commentPart(line);
      if (!comment) return;
      const label = firstMatch(comment);
      if (label)
        hits.push(`  ${i + 1}: [${label}] ${line.trim().slice(0, 100)}`);
    });
  if (hits.length) perFile.set(f, hits);
}

const total = [...perFile.values()].reduce((n, h) => n + h.length, 0);
for (const [f, hits] of perFile) console.log(`\n${f}\n${hits.join("\n")}`);
console.log(`\n${total} archaeology hit(s) in ${perFile.size} file(s).`);
process.exit(total ? 1 : 0);
