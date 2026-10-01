import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("app.css", () => {
  it("keeps focused controls clear of the sticky toolbar (WCAG 2.4.11)", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/app.css"),
      "utf8",
    );
    expect(css).toMatch(
      /scroll-padding-top:\s*var\(--sticky-toolbar-offset,\s*5rem\)/,
    );
  });
});
