import { describe, expect, it } from "vitest";

import { type ControlInfo, pageKey, sameOrigin, skipReason } from "./policy.ts";

const base: ControlInfo = {
  tag: "button",
  role: "button",
  name: "Open filters",
  type: "button",
  href: null,
  disabled: false,
};

describe("ui-crawl policy", () => {
  it("collapses ids into one page key", () => {
    expect(
      pageKey(
        "http://x/lead/report/a0000000-0000-4000-8000-000000000001?mode=slides",
      ),
    ).toBe("/lead/report/:id?mode=slides");
    expect(pageKey("http://x/reports/12")).toBe("/reports/:n");
  });

  it("keeps links on the target origin only", () => {
    expect(sameOrigin("http://x:8080/a", "http://x:8080")).toBe(true);
    expect(sameOrigin("http://y/a", "http://x:8080")).toBe(false);
    expect(sameOrigin("mailto:a@b", "http://x:8080")).toBe(false);
  });

  it("presses safe controls and skips others with a reason", () => {
    expect(skipReason(base)).toBeNull();
    expect(skipReason({ ...base, disabled: true })).toBe("disabled");
    expect(skipReason({ ...base, href: "/reports" })).toMatch(/^link/);
    expect(skipReason({ ...base, name: "Publish now" })).toBe(
      "dangerous: publish",
    );
    expect(skipReason({ ...base, name: "Go", type: "submit" })).toBe(
      "dangerous: form submit",
    );
    expect(skipReason({ ...base, name: "Reopen period" })).toBe(
      "dangerous: reopen",
    );
    expect(skipReason({ ...base, name: "Deactivate Ivan" })).toBe(
      "dangerous: deactivate",
    );
    for (const verb of [
      "Detach",
      "Attach",
      "Unlink",
      "Assign",
      "Unassign",
      "Toggle",
    ])
      expect(skipReason({ ...base, name: `${verb} product` })).toBe(
        `dangerous: ${verb.toLowerCase()}`,
      );
  });
});
