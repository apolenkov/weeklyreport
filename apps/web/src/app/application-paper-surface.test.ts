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
    const utilitiesStart = appCss.indexOf(
      "/*\n * Force-generate utilities",
      paperStart,
    );
    const paperCss = appCss.slice(paperStart, utilitiesStart);

    expect(paperCss).not.toMatch(/animation\s*:/);
    expect(paperCss).not.toMatch(/content\s*:/);
  });
});
