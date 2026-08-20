// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readPackageStyleSource } from "../../../test-utils/package-style-source";

const css = readPackageStyleSource();

describe("Head Presentation slide canvas tokens", () => {
  it("uses the full report-frame width and compact auto-growing minimum", () => {
    expect(css).toMatch(/--slide-canvas-max-w:\s*100%/);
    expect(css).toMatch(/--slide-canvas-min-h:\s*360px/);
    expect(css).not.toMatch(/--slide-canvas-max-w:\s*1088px/);
    expect(css).not.toMatch(/--slide-canvas-min-h:\s*680px/);
  });
});
