/// <reference lib="dom" />
// @vitest-environment jsdom

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { pressBatch, type PressResult } from "./batch.ts";
import { parseCli } from "./config.ts";
import { crawlFullPages } from "./full.ts";
import type { FullControl, FullProbe } from "./full-probe.ts";
import { mergeReports } from "./merge.ts";
import { crawlPages } from "./page.ts";
import { finishPress, runBatch } from "./press.ts";
import type { ProbedControl } from "./probe.ts";
import { settleRate } from "./rate.ts";
import { identity, planEntries, pressEntries } from "./round.ts";
import { testContext } from "./test-context.fixture.ts";
import { crawlRole } from "./worker.ts";
vi.mock("./rate.ts", () => ({
  pace: () => 123,
  settleRate: vi.fn(),
  configureRate: vi.fn(),
}));
vi.mock("./driver.ts", () => ({ createBrowser: vi.fn() }));
const root = join(import.meta.dirname, "../../output/crawl-artifact-tests");
const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.body.replaceChildren();
  sessionStorage.clear();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function output() {
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "page-"));
  dirs.push(dir);
  return dir;
}
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
const press: PressResult = {
  n: 0,
  status: "ok",
  before: "http://127.0.0.1:50123/fixture|base",
  after: "http://127.0.0.1:50123/fixture|changed",
  urlChanged: false,
  ms: 1,
  blockedMs: 0,
  logs: [],
};
describe("crawler screenshot evidence", () => {
  it.each(["initial", "completed"] as const)(
    "retains current evidence and aborts traversal after %s storage failure",
    async (phase) => {
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const pageWindow = iframe.contentWindow;
      const pageDocument = iframe.contentDocument;
      if (!pageWindow || !pageDocument)
        throw new Error("Missing JSDOM iframe realm");
      Object.defineProperty(pageWindow, "__crawl2", {
        value: { req: 0 },
        configurable: true,
      });
      expect(pageWindow).not.toBe(window);
      expect(
        Object.getOwnPropertyDescriptor(pageWindow, "__crawl2"),
      ).toMatchObject({ value: { req: 0 } });
      const storage = pageWindow.sessionStorage;
      pageDocument.body.innerHTML =
        '<select id="mode" disabled><option value="a">Alpha</option><option value="b">Beta</option></select><select id="next"><option value="a">Alpha</option><option value="b">Beta</option></select>';
      const ctx = { ...testContext(), dir: output() };
      const first: FullControl = {
        ...control,
        selector: "#mode",
        tag: "select",
        role: "combobox",
        alternatives: ["b"],
        elementId: "mode",
        row: null,
        surface: null,
        form: false,
        group: null,
        value: "a",
        expanded: false,
        options: ["a", "b"],
      };
      const next: FullControl = {
        ...first,
        selector: "#next",
        elementId: "next",
        name: "Inspect next",
      };
      let actions = 0;
      pageDocument
        .getElementById("next")
        ?.addEventListener("input", () => actions++);
      const generated = async (
        controls: readonly ProbedControl[],
      ): Promise<unknown> => {
        let source = "";
        vi.mocked(ctx.browser.evaluate).mockImplementation((script) => {
          source = script;
        });
        pressBatch(ctx.browser, controls, {
          budgetMs: 1000,
          maxQuietMs: 100,
          mode: "quick",
        });
        const result = new Promise<unknown>((resolve) => {
          pageDocument.addEventListener(
            "crawl-batch-result",
            (event) => {
              resolve((event as CustomEvent<unknown>).detail);
            },
            { once: true },
          );
        });
        const script = pageDocument.createElement("script");
        script.textContent = `document.dispatchEvent(new CustomEvent('crawl-batch-result', {detail: ${source}}));`;
        pageDocument.body.append(script);
        try {
          return await result;
        } finally {
          script.remove();
        }
      };
      if (phase === "initial") {
        await generated([first]);
        expect(
          JSON.parse(storage.getItem("__crawlRes") ?? "null"),
        ).toMatchObject([
          { n: 0, status: "stale", reason: "select is disabled" },
        ]);
      }
      const nativeSetItem = storage.setItem.bind(storage);
      const setItem = vi.spyOn(
        Object.getPrototypeOf(storage) as Storage,
        "setItem",
      );
      if (phase === "completed") setItem.mockImplementationOnce(nativeSetItem);
      setItem.mockImplementation(() => {
        throw new DOMException(
          "Completed evidence quota exceeded",
          "QuotaExceededError",
        );
      });
      const outcome = await generated([first, next]);
      if (phase === "completed")
        expect(storage.getItem("__crawlRes")).toBe("[]");
      const rows =
        phase === "initial"
          ? []
          : [{ n: 0, status: "stale", reason: "select is disabled" }];
      expect(outcome).toMatchObject({
        results: rows,
        stopped: true,
        req: null,
        error:
          "sessionStorage: QuotaExceededError: Completed evidence quota exceeded",
      });
      expect(outcome).toHaveProperty("took", expect.any(Number));
      expect(actions).toBe(0);
      vi.mocked(ctx.browser.evaluate).mockReturnValue(outcome);
      const target = {
        key: "/fixture",
        url: "http://127.0.0.1:50123/fixture",
        shotBase: "fixture",
      };
      const result = runBatch(ctx, target, [first, next]);
      expect(result).toMatchObject({
        outcome: { results: rows, req: null },
        hungReason:
          "sessionStorage: QuotaExceededError: Completed evidence quota exceeded",
        restored: false,
      });
      expect(settleRate).not.toHaveBeenCalled();
      expect(ctx.findings.map((f) => f.kind)).toEqual([
        "press-batch-failed",
        "coverage-incomplete",
      ]);
      const probe: FullProbe = {
        url: target.url,
        title: "Fixture",
        viewport: { width: 1280, height: 720 },
        controls: [first, next],
        links: [],
        geometry: [],
        signature: "baseline",
        surface: null,
      };
      const counters = { pressed: 0, families: new Map<string, number>() };
      const entries = planEntries(
        ctx,
        {
          probe,
          live: new Map(probe.controls.map((c) => [identity(c), c])),
          counters,
        },
        0,
      );
      const round = pressEntries(
        ctx,
        { ...target, tag: "fixture" },
        entries,
        counters,
      );
      expect(round).toMatchObject({ next: null, aborted: true });
      if (phase === "completed")
        expect(round.steps[0]).toMatchObject({
          reason: "select is disabled",
          shot: null,
        });
      let failed = false;
      let attempts = 0;
      let dependentReads = 0;
      let dependentCommands = 0;
      vi.mocked(ctx.browser.evaluate).mockImplementation((source): unknown => {
        if (source.includes("const items =")) {
          failed = true;
          attempts++;
          return outcome;
        }
        if (failed) {
          dependentReads++;
          throw new Error("Dependent probe/rebase on failed page");
        }
        if (source === "location.pathname") return "/fixture";
        if (source.includes("const GEOM =")) return probe;
        if (source.includes("await axe.run")) return [];
        if (source.includes("const n = S.req")) return 0;
        return "baseline";
      });
      vi.mocked(ctx.browser.batch).mockImplementation((commands) => {
        if (failed) {
          dependentCommands++;
          throw new Error("Dependent screenshot/action on failed page");
        }
        return commands.map(() => ({ ok: true, error: null, value: {} }));
      });
      const page = crawlFullPages(
        { ...ctx, config: { ...ctx.config, mode: "full" } },
        target.url,
        "",
      )[0];
      expect(page?.completion).toBe("error");
      expect(attempts).toBe(1);
      expect(dependentReads).toBe(0);
      expect(dependentCommands).toBe(0);
      expect(actions).toBe(0);
    },
  );

  it("does not reference a failed step capture and still restores the changed surface", () => {
    const ctx = testContext();
    vi.mocked(ctx.browser.batch).mockReturnValue([
      { ok: false, error: "CAPTURE unavailable", value: null },
    ]);
    let restored = false;
    vi.mocked(ctx.browser.evaluate).mockImplementation(() => {
      restored = true;
      return "http://127.0.0.1:50123/fixture|base";
    });
    const step = finishPress(
      ctx,
      {
        key: "/fixture",
        url: "http://127.0.0.1:50123/fixture",
        shotBase: "fixture",
      },
      control,
      press,
    );
    expect(step.shot).toBeNull();
    expect(restored).toBe(true);
    expect(step.restoredBy).toBe("escape");
    expect(
      ctx.findings.some((f) => f.detail.includes("CAPTURE unavailable")),
    ).toBe(true);
  });
  it.each([
    ["quick", crawlPages],
    ["full", crawlFullPages],
  ] as const)(
    "represents an aborted %s page without a directory link",
    (_mode, crawl) => {
      const ctx = testContext();
      vi.mocked(ctx.browser.batch).mockImplementation(() => {
        throw new Error("PAGE unavailable");
      });
      expect(
        crawl(ctx, "http://127.0.0.1:50123/fixture", "")[0]?.shot,
      ).toBeNull();
    },
  );
  it("retains an observed quick page when its screenshot command fails", () => {
    const ctx = testContext();
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map((command) => ({
        ok: command[0] !== "screenshot",
        error: command[0] === "screenshot" ? "PAGE CAPTURE unavailable" : null,
        value: {},
      })),
    );
    vi.mocked(ctx.browser.evaluate).mockImplementation((source): unknown =>
      source === "location.pathname"
        ? "/fixture"
        : source.includes("const GEOM =")
          ? {
              url: "http://127.0.0.1:50123/fixture",
              title: "Fixture",
              viewport: { width: 1280, height: 720 },
              controls: [],
              links: [],
              geometry: [],
            }
          : source.includes("await axe.run")
            ? []
            : source.includes("const n = S.req")
              ? 0
              : "http://127.0.0.1:50123/fixture|base",
    );
    const pages = crawlPages(ctx, "http://127.0.0.1:50123/fixture", "");
    expect(pages[0]?.shot).toBeNull();
    expect(
      ctx.findings.some((f) => f.detail.includes("PAGE CAPTURE unavailable")),
    ).toBe(true);
  });
  it("keeps the relative filename of a confirmed successful capture", () => {
    const ctx = { ...testContext(), dir: output() };
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map((command) => {
        if (command[0] === "screenshot" && command[1])
          writeFileSync(
            command[1],
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPZkAAAAASUVORK5CYII=",
              "base64",
            ),
          );
        return { ok: true, error: null, value: {} };
      }),
    );
    vi.mocked(ctx.browser.evaluate).mockReturnValue(
      "http://127.0.0.1:50123/fixture|base",
    );
    const step = finishPress(
      ctx,
      {
        key: "/fixture",
        url: "http://127.0.0.1:50123/fixture",
        shotBase: "fixture",
      },
      control,
      press,
    );
    expect(step.shot).toBe("fixture.png");
    expect(existsSync(join(ctx.dir, "fixture.png"))).toBe(true);
  });
  it("preserves null when worker output is relativized", async () => {
    vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    const ctx = testContext();
    const { createBrowser } = await import("./driver.ts");
    vi.mocked(createBrowser).mockReturnValue(ctx.browser);
    const config = {
      ...parseCli(["--url", "http://127.0.0.1:50123", "--no-video"]).config,
      out: output(),
      widths: [1280],
    };
    let loaded = false;
    vi.mocked(ctx.browser.batch).mockImplementation((commands) => {
      if (loaded && commands[0]?.[0] === "open")
        throw new Error("PAGE unavailable");
      return commands.map(() => ({ ok: true, error: null, value: {} }));
    });
    vi.mocked(ctx.browser.evaluate).mockImplementation((source) => {
      if (source === "location.href") {
        loaded = true;
        return "http://127.0.0.1:50123/fixture";
      }
      return "/fixture";
    });
    const runs = crawlRole(config, ctx.role, "fixture-password");
    expect(runs[0]?.pages[0]?.shot).toBeNull();
  });
  it("preserves absent page evidence through merged JSON reports", () => {
    const dir = output();
    const part = join(dir, "state-open", "readonly");
    mkdirSync(part, { recursive: true });
    writeFileSync(
      join(part, "report.json"),
      JSON.stringify({
        url: "http://127.0.0.1:50123",
        started: "fixture",
        wallMs: 0,
        results: [
          {
            role: "lead",
            ms: 0,
            runs: [
              {
                role: "lead",
                width: 1280,
                ms: 0,
                video: "fixture.webm",
                findings: [],
                pages: [
                  {
                    url: "http://127.0.0.1:50123/fixture",
                    key: "/fixture",
                    loadMs: 0,
                    shot: null,
                    controlsFound: 0,
                    axeViolations: 0,
                    geometryIssues: 0,
                    steps: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(mergeReports(dir)).toEqual({ passes: 1, missing: [] });
    const merged = JSON.parse(
      readFileSync(join(dir, "report.json"), "utf8"),
    ) as { results: { runs: { pages: { shot: string | null }[] }[] }[] };
    expect(merged.results[0]?.runs[0]?.pages[0]?.shot).toBeNull();
  });
});
