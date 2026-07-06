/**
 * @vitest-environment node
 *
 * Teeth for the central compact-floor mechanism: every toolbar-token consumer
 * (`h-[var(--toolbar-control-h)]`, class-asserted in component tests) only
 * meets the 44px touch floor below `md` because ONE media override in the
 * shared stylesheet raises the token. jsdom cannot compute media queries, so
 * this test reads the stylesheet as text — deleting or breaking the override
 * must fail CI even though every component class assertion stays green.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest always runs with cwd = apps/web (the config's root), so the shared
// stylesheet resolves two package levels up.
const css = readFileSync(
  path.resolve(process.cwd(), "../../packages/ui/src/styles/globals.css"),
  "utf8",
);

describe("shared toolbar control token (responsive-compact-layout)", () => {
  it("defines the 2rem desktop token and the 44px touch-target floor", () => {
    expect(css).toMatch(/--toolbar-control-h:\s*2rem/);
    expect(css).toMatch(/--touch-target-min:\s*44px/);
  });

  it("raises the token to the touch floor below the 48rem compact boundary", () => {
    const mediaStart = css.indexOf("@media (width < 48rem)");
    expect(mediaStart).toBeGreaterThan(-1);

    // The override sits directly inside the media block; a bounded window
    // keeps the assertion from matching an assignment elsewhere in the file.
    const mediaBlock = css.slice(mediaStart, mediaStart + 300);
    expect(mediaBlock).toContain(
      "--toolbar-control-h: var(--touch-target-min)",
    );
  });
});
