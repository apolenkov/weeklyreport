import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const APP_CSS_PATH = resolve(import.meta.dirname, "../styles/app.css");
const appCss = readFileSync(APP_CSS_PATH, "utf8");

describe("desktop application paper surface", () => {
  it("uses token-driven, CSS-only abstract layers at the desktop breakpoint", () => {
    expect(appCss).toContain(".operational-paper-shell");
    expect(appCss).toContain("@media (width >= 64rem)");
    expect(appCss).toContain("radial-gradient");
    expect(appCss).toContain("conic-gradient");
    expect(appCss).toContain("color-mix(in srgb, var(--color-primary)");
    expect(appCss).toContain("color-mix(in srgb, var(--color-starbucks-gold)");
  });

  it("keeps the decorative surface free of semantic or animated content", () => {
    const paperStart = appCss.indexOf(".operational-paper-shell");
    // Keep the assertion scoped to the surface rules. Global keyframes below
    // the component layer are intentionally used by status indicators and do
    // not make the paper surface itself animated or semantic.
    const keyframesStart = appCss.indexOf(
      "/* Pulsing red dot anchored",
      paperStart,
    );
    const paperCss = appCss.slice(
      paperStart,
      keyframesStart === -1 ? appCss.length : keyframesStart,
    );

    expect(paperCss).not.toMatch(/animation\s*:/);
    expect(paperCss).not.toMatch(/content\s*:/);
  });
});

describe("risk-summary motion preference", () => {
  it("keeps the risk signal static when reduced motion is requested", () => {
    expect(appCss).toContain(".risk-pulse {");
    expect(appCss).toContain(
      "animation: risk-pulse 1.6s ease-in-out infinite;",
    );
    expect(appCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.risk-pulse\s*{\s*animation: none;/,
    );
  });
});
