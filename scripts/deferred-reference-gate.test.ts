import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DEFERRED_DIR = path.join(REPO_ROOT, "openspec", "deferred");
// Source roots a live deferred marker may live in.
const SOURCE_ROOTS = ["apps", "packages", "prisma", "scripts", "tools"];

// Instructional qualifiers: the doc explicitly says the marker is not live yet
// (re-establish / retire guidance), so an unresolved reference is intentional.
const REESTABLISH_QUALIFIERS = [
  "re-establish",
  "no live",
  "no longer exist",
  "marker no longer exists",
  "to-be-planted",
];

const MARKER_RE = /TODO\(([a-zA-Z0-9_-]+)\)/g;

function collectFiles(
  dir: string,
  predicate: (name: string) => boolean,
): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full, predicate);
    return predicate(entry.name) ? [full] : [];
  });
}

function collectSourceMarkers(): Set<string> {
  const markers = new Set<string>();
  for (const root of SOURCE_ROOTS) {
    const dir = path.join(REPO_ROOT, root);
    for (const file of collectFiles(dir, (name) =>
      /\.(ts|tsx|mjs|js)$/.test(name),
    )) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(MARKER_RE)) {
        const ref = match[1];
        if (ref !== undefined) markers.add(ref);
      }
    }
  }
  return markers;
}

function deferredDocs(): string[] {
  return collectFiles(DEFERRED_DIR, (name) => name.endsWith(".md"));
}

void test("every deferred reference resolves to a live source marker or an explicit re-establishment note", () => {
  const liveMarkers = collectSourceMarkers();
  const docs = deferredDocs();
  assert.ok(docs.length > 0, "deferred docs should exist");
  const dead: string[] = [];

  for (const doc of docs) {
    const text = readFileSync(doc, "utf8");
    for (const match of text.matchAll(MARKER_RE)) {
      const ref = match[1];
      if (ref === undefined) continue;
      if (liveMarkers.has(ref)) continue;
      // Check the WHOLE line for an explicit "not live yet" qualifier, before
      // or after the marker (e.g. "no live TODO(x) marker exists" or
      // "TODO(x) marker (to-be-planted, not live)").
      const lineStart =
        match.index > 0 ? text.lastIndexOf("\n", match.index) + 1 : 0;
      const lineEnd = text.indexOf("\n", match.index + match[0].length);
      const line = text.slice(
        lineStart,
        lineEnd === -1 ? text.length : lineEnd,
      );
      const qualified = REESTABLISH_QUALIFIERS.some((qualifier) =>
        line.toLowerCase().includes(qualifier),
      );
      if (!qualified) {
        dead.push(`${path.relative(REPO_ROOT, doc)}: TODO(${ref})`);
      }
    }
  }

  assert.deepEqual(
    dead,
    [],
    `unresolved deferred references:\n${dead.join("\n")}`,
  );
});
