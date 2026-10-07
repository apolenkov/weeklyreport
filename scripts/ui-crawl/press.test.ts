import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PressResult } from "./batch.ts";
import { parseCli } from "./config.ts";
import type { Browser } from "./driver.ts";
import type { Ctx } from "./logs.ts";
import { crawlPages } from "./page.ts";
import { runBatch } from "./press.ts";
import type { ProbedControl } from "./probe.ts";
import { settleRate } from "./rate.ts";
import { planEntries, pressEntries } from "./round.ts";

vi.mock("./rate.ts", () => ({ pace: () => 123, settleRate: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
});

const url = "http://127.0.0.1:50123/fixture";
const control: ProbedControl = {
  selector: "#inspect",
  tag: "button",
  role: "button",
  name: "Inspect health",
  type: "button",
  href: null,
  disabled: false,
  selected: false,
  alternatives: [],
  bounds: { x: 0, y: 0, width: 100, height: 30 },
  clipped: false,
  obstructedBy: null,
};
const finished: PressResult = {
  n: 0,
  status: "ok",
  before: `${url}|base`,
  after: `${url}|base`,
  urlChanged: false,
  ms: 1,
  blockedMs: 0,
  logs: [],
};

function context(): Ctx {
  const browser: Browser = {
    session: "recovery-test",
    profile: new Map(),
    stalls: [],
    restarts: [],
    close: vi.fn(),
    batch: vi.fn(() => []),
    evaluate: vi.fn(),
  };
  return {
    browser,
    config: parseCli(["--url", "http://127.0.0.1:50123", "--no-video"]).config,
    role: {
      name: "lead",
      email: "lead@fixture.local",
      passwordKey: "PW_LEAD1",
    },
    width: 1280,
    dir: "output",
    findings: [],
    signIn: vi.fn(),
  };
}

describe("hung batch recovery", () => {
  it("keeps a changed completed press in the page artifact without reading the failed page again", () => {
    const ctx = context();
    let failed = false;
    let opens = 0;
    const probe = {
      url,
      title: "Fixture",
      viewport: { width: 1280, height: 720 },
      controls: [control],
      links: [],
      geometry: [],
    };
    vi.mocked(ctx.browser.evaluate).mockImplementation((source): unknown => {
      if (source.includes("sessionStorage.getItem"))
        return JSON.stringify([{ ...finished, after: `${url}|changed` }]);
      if (failed)
        throw new Error("Unknown page must not be read after failed recovery");
      if (source.includes("const items =")) {
        failed = true;
        throw new Error("PRIMARY timeout");
      }
      if (source === "location.pathname") return "/fixture";
      if (source.includes("const GEOM =")) return probe;
      if (source.includes("await axe.run")) return [];
      if (source.includes("const n = S.req")) return 0;
      return `${url}|base`;
    });
    vi.mocked(ctx.browser.batch).mockImplementation((commands) => {
      if (commands[0]?.[0] === "open" && ++opens > 1)
        throw new Error("SECONDARY restore failed");
      return commands.map(() => ({ ok: true, error: null, value: {} }));
    });

    const pages = crawlPages(ctx, url, "");

    expect(pages[0]?.steps[0]).toMatchObject({
      action: "pressed",
      stateChanged: true,
      responseMs: 1,
      shot: null,
    });
    expect(opens).toBe(2);
    expect(ctx.signIn).not.toHaveBeenCalled();
  });

  it("does not accept a failed open result as restored", () => {
    const ctx = context();
    vi.mocked(ctx.browser.evaluate).mockImplementation((source): unknown => {
      if (source.includes("sessionStorage.getItem")) return "[]";
      if (source.includes("const items =")) throw new Error("PRIMARY timeout");
      if (source === "location.pathname") return "/fixture";
      if (source.includes("const n = S.req")) return 0;
      return `${url}|base`;
    });
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map((command) =>
        command[0] === "open"
          ? { ok: false, error: "SECONDARY open failed", value: null }
          : { ok: true, error: null, value: null },
      ),
    );

    const result = runBatch(
      ctx,
      { key: "/fixture", url, shotBase: "fixture" },
      [control],
    );

    expect(result.restored).toBe(false);
    expect(
      ctx.findings.some((f) => f.detail.includes("SECONDARY open failed")),
    ).toBe(true);
  });

  it("delivers completed presses and stops the page when reopening fails", () => {
    const ctx = context();
    let saved = JSON.stringify([finished]);
    vi.mocked(ctx.browser.evaluate).mockImplementation((source) => {
      if (source.includes("sessionStorage.getItem")) return saved;
      throw new Error("PRIMARY browser timeout");
    });
    vi.mocked(ctx.browser.batch).mockImplementation((commands) => {
      if (commands[0]?.[0] === "open") {
        saved = "[]";
        throw new Error("SECONDARY restore failed");
      }
      return commands.map(() => ({ ok: true, error: null, value: null }));
    });
    const counters = { pressed: 0, families: new Map<string, number>() };
    const controls = [
      control,
      { ...control, selector: "#next", name: "Next action" },
    ];
    const entries = planEntries(
      ctx,
      {
        probe: {
          url,
          title: "Fixture",
          viewport: { width: 1280, height: 720 },
          controls,
          links: [],
          geometry: [],
        },
        live: new Map(controls.map((c) => [`button|button|${c.name}`, c])),
        counters,
      },
      0,
    );

    const round = pressEntries(
      ctx,
      { key: "/fixture", url, tag: "fixture" },
      entries,
      counters,
    );

    expect(round.steps[0]).toMatchObject({
      name: "Inspect health",
      action: "pressed",
    });
    expect(round.steps[1]).toMatchObject({
      action: "error",
      reason: "PRIMARY browser timeout",
    });
    expect(round.next).toBeNull();
    const incomplete = ctx.findings.find(
      (f) => f.kind === "coverage-incomplete",
    );
    expect(incomplete?.detail).toContain("SECONDARY restore failed");
    expect(settleRate).not.toHaveBeenCalled();
  });

  it("reports unavailable recovery evidence and request count without claiming zero", () => {
    const ctx = context();
    vi.mocked(ctx.browser.evaluate).mockImplementation((source) => {
      throw new Error(
        source.includes("sessionStorage.getItem")
          ? "RECOVERY storage unavailable"
          : "PRIMARY timeout",
      );
    });
    vi.mocked(ctx.browser.batch).mockImplementation(() => {
      throw new Error("RESTORE transport unavailable");
    });

    const result = runBatch(
      ctx,
      { key: "/fixture", url, shotBase: "fixture" },
      [control],
    );

    expect(result.hungReason).toBe("PRIMARY timeout");
    expect(result.outcome.req).toBeNull();
    expect(
      ctx.findings.some((f) =>
        f.detail.includes("RECOVERY storage unavailable"),
      ),
    ).toBe(true);
  });
});
