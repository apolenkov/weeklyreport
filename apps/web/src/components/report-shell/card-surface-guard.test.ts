/**
 * @vitest-environment node
 *
 * Teeth for the web-shared-idioms extractions. jsdom class assertions confirm a
 * consumer renders `card-surface` / the shared `RotatingChevron`, but they stay
 * green even if someone re-inlines the mega-literal or hand-rolls a rotating
 * chevron again. This scans the web source as text so a reintroduced copy fails.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs with cwd = apps/web (the config root).
const SRC_DIR = path.resolve(process.cwd(), "src");
const CSS_PATH = path.resolve(
  process.cwd(),
  "../../packages/ui/src/styles/globals.css",
);

// The unique needle: the layered card-surface box-shadow. The 0.97/0.94 gradient
// alone also lives in the out-of-scope activity strip (lighter shadow), so the
// shadow — present in every in-scope card and nowhere else — is what we guard.
const CARD_SURFACE_SHADOW_LITERAL = "0_8px_18px_-14px_rgba(0,0,0,0.18)";
// A hand-rolled rotating chevron; only the shared component may rotate one.
const ROTATING_CHEVRON_LITERAL = "rotate(-90deg";
const ROTATING_CHEVRON_HOME = "rotating-chevron.tsx";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__snapshots__" ? [] : sourceFiles(full);
    }
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      return [];
    }
    return [full];
  });
}

const files = sourceFiles(SRC_DIR).map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));

describe("web-shared-idioms source guards", () => {
  it("homes the card surface once in the shared stylesheet", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toMatch(/\.card-surface\s*\{/);
    expect(css).toContain("--card-surface-gradient");
  });

  it("no web source re-inlines the card-surface mega-literal", () => {
    const offenders = files
      .filter(({ text }) => text.includes(CARD_SURFACE_SHADOW_LITERAL))
      .map(({ file }) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });

  it("no web source hand-rolls a rotating chevron outside the shared one", () => {
    const offenders = files
      .filter(
        ({ file, text }) =>
          text.includes(ROTATING_CHEVRON_LITERAL) &&
          !file.endsWith(ROTATING_CHEVRON_HOME),
      )
      .map(({ file }) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });
});
