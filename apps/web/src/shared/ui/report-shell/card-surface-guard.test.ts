// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readPackageStyleSource } from "../../../test-utils/package-style-source";

const SRC_DIR = path.resolve(process.cwd(), "src");

const CARD_SURFACE_SHADOW_LITERAL = "0_8px_18px_-14px_rgba(0,0,0,0.18)";
const ROTATING_CHEVRON_LITERAL = "rotate(-90deg";
const INLINE_CHEVRON_PATH = /<path\s+d=["']M9 18l6-6-6-6["']/;
const INLINE_CHEVRON_POLYLINE = /<polyline\s+points=["']9 18 15 12 9 6["']/;
const INLINE_CHEVRON_ROTATION = /rotate\((?:0|90)deg\)|rotate-90/;
const ROTATING_CHEVRON_HOME = "rotating-chevron.tsx";

// The detection predicates, extracted so a planted positive/negative probe
// can pin what they catch instead of only scanning the live source.
export function reusesCardSurfaceShadow(text: string): boolean {
  return text.includes(CARD_SURFACE_SHADOW_LITERAL);
}

export function handRollsRotatingChevron(
  text: string,
  fileName: string,
): boolean {
  return (
    (text.includes(ROTATING_CHEVRON_LITERAL) ||
      ((INLINE_CHEVRON_PATH.test(text) || INLINE_CHEVRON_POLYLINE.test(text)) &&
        INLINE_CHEVRON_ROTATION.test(text))) &&
    !fileName.endsWith(ROTATING_CHEVRON_HOME)
  );
}

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

describe("web-shared-idioms source guards — predicate probes", () => {
  it("detects a planted re-inlined card-surface shadow literal", () => {
    expect(
      reusesCardSurfaceShadow(`shadow-[0_8px_18px_-14px_rgba(0,0,0,0.18)]`),
    ).toBe(true);
  });

  it("does not flag a clean source without the card-surface literal", () => {
    expect(
      reusesCardSurfaceShadow("boxShadow: var(--card-surface-shadow)"),
    ).toBe(false);
  });

  it("detects a planted hand-rolled rotating chevron outside its home file", () => {
    expect(
      handRollsRotatingChevron("transform: rotate(-90deg)", "other.tsx"),
    ).toBe(true);
  });

  it("does not flag the rotating-chevron home file itself", () => {
    expect(
      handRollsRotatingChevron(
        "transform: rotate(-90deg",
        "rotating-chevron.tsx",
      ),
    ).toBe(false);
  });

  it("detects an inline right-chevron rotated down when expanded", () => {
    expect(
      handRollsRotatingChevron(
        `<svg style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}><path d="M9 18l6-6-6-6" /></svg>`,
        "other.tsx",
      ),
    ).toBe(true);
  });

  it("does not flag an unrelated rotating icon", () => {
    expect(
      handRollsRotatingChevron(
        `<svg style={{ transform: "rotate(90deg)" }}><path d="M12 2v20" /></svg>`,
        "other.tsx",
      ),
    ).toBe(false);
  });

  it("detects an inline right-chevron using a rotated utility class", () => {
    expect(
      handRollsRotatingChevron(
        `<svg className={expanded ? "rotate-90" : ""}><polyline points="9 18 15 12 9 6" /></svg>`,
        "other.tsx",
      ),
    ).toBe(true);
  });

  it("homes the card surface once in the shared stylesheet", () => {
    const css = readPackageStyleSource();
    expect(css).toMatch(/\.card-surface\s*\{/);
    expect(css).toContain("--card-surface-gradient");
  });

  it("no web source re-inlines the card-surface mega-literal", () => {
    const offenders = files
      .filter(({ text }) => reusesCardSurfaceShadow(text))
      .map(({ file }) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });

  it("no web source hand-rolls a rotating chevron outside the shared one", () => {
    const offenders = files
      .filter(({ file, text }) =>
        handRollsRotatingChevron(text, path.basename(file)),
      )
      .map(({ file }) => path.relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });
});
