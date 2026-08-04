// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readPackageStyleSource } from "../../../test-utils/package-style-source";

const css = readPackageStyleSource();

describe("shared toolbar control token", () => {
  it("defines the 2rem desktop token and the 44px touch-target floor", () => {
    expect(css).toMatch(/--toolbar-control-h:\s*2rem/);
    expect(css).toMatch(/--touch-target-min:\s*44px/);
  });

  it("raises the token to the touch floor below the 48rem compact boundary", () => {
    const mediaStart = css.indexOf("@media (width < 48rem)");
    expect(mediaStart).toBeGreaterThan(-1);

    // A bounded window prevents an unrelated assignment from satisfying the
    // compact-media assertion.
    const mediaBlock = css.slice(mediaStart, mediaStart + 300);
    expect(mediaBlock).toContain(
      "--toolbar-control-h: var(--touch-target-min)",
    );
  });
});
