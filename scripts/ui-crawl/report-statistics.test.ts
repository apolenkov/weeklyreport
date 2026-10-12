import { describe, expect, it, vi } from "vitest";

import { drainLogs } from "./logs.ts";
import { pageKey } from "./policy.ts";
import { renderMarkdown } from "./report.ts";
import { testContext } from "./test-context.fixture.ts";
import type { Finding, StepRecord } from "./types.ts";
function report(
  values: readonly (number | null)[],
  findings: readonly Finding[] = [],
  key = "/fixture",
  reason: string | null = null,
) {
  const steps: StepRecord[] = values.map((responseMs, index) => ({
    name: `Action ${index}`,
    tag: "button",
    action: reason === null ? "pressed" : "skipped",
    reason,
    urlChanged: false,
    stateChanged: false,
    restoredBy: "none",
    responseMs,
    shot: null,
  }));
  return renderMarkdown(
    {
      url: "http://127.0.0.1:50123",
      wallMs: 0,
      started: "fixture",
      parallel: 1,
    },
    [
      {
        role: "lead",
        ms: 0,
        runs: [
          {
            role: "lead",
            width: 1280,
            ms: 0,
            video: null,
            pages: [
              {
                url: "http://127.0.0.1:50123/fixture",
                key,
                loadMs: 0,
                shot: null,
                controlsFound: steps.length,
                axeViolations: 0,
                geometryIssues: 0,
                steps,
              },
            ],
            findings,
          },
        ],
      },
    ],
  );
}
describe("crawler response statistics", () => {
  it("reports empty observations as not measured with sample count", () => {
    expect(report([null])).toContain("not measured (n=0)");
  });
  it("uses nearest rank for twenty measured responses", () => {
    expect(
      report(Array.from({ length: 20 }, (_, index) => index + 1)),
    ).toContain("19 ms (n=20)");
  });
  it("keeps actual zero while excluding unavailable responses", () => {
    expect(report([null, 0, null])).toContain("0 ms (n=1)");
    expect(report([7])).toContain("7 ms (n=1)");
  });

  it.each(["\n", "\r\n", "\r"])(
    "keeps observed console text, page labels and skip reasons inside their report entries (%j)",
    (lineBreak) => {
      const ctx = testContext();
      const detail = [
        "Error: failed",
        "# Forged heading",
        "* Forged item",
        "    at [handler](url)",
      ].join(lineBreak);
      const key = pageKey("http://127.0.0.1:50123/fixture?mode=**highlight**");
      vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
        commands.map(() => ({
          ok: true,
          error: null,
          value: { messages: [{ type: "error", text: detail }] },
        })),
      );
      drainLogs(ctx, { page: key, shot: null });
      const before = JSON.stringify(ctx.findings);
      const rendered = report(
        [null],
        ctx.findings,
        key,
        ["gone: # Missing", "* Not another item"].join(lineBreak),
      );

      expect(rendered).not.toContain("\n# Forged heading");
      expect(rendered).not.toContain("\n* Forged item");
      expect(rendered).not.toContain("\n* Not another item");
      expect(rendered).toContain(String.raw`\# Forged heading`);
      expect(rendered).toContain(String.raw`\* Forged item`);
      expect(rendered).toContain(String.raw`at \[handler\]\(url\)`);
      expect(rendered).toContain(String.raw`/fixture?mode=\*\*highlight\*\*`);
      expect(rendered).not.toContain("/fixture?mode=**highlight**");
      expect(rendered).toContain(
        String.raw`gone: \# Missing \* Not another item`,
      );
      expect(ctx.findings[0]?.detail).toBe(detail);
      expect(JSON.stringify(ctx.findings)).toBe(before);
    },
  );
});
