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

import type { PressResult } from "./batch.ts";
import { parseCli } from "./config.ts";
import { crawlFullPages } from "./full.ts";
import { mergeReports } from "./merge.ts";
import { crawlPages } from "./page.ts";
import { finishPress } from "./press.ts";
import type { ProbedControl } from "./probe.ts";
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
    expect(mergeReports(dir)).toBe(1);
    const merged = JSON.parse(
      readFileSync(join(dir, "report.json"), "utf8"),
    ) as { results: { runs: { pages: { shot: string | null }[] }[] }[] };
    expect(merged.results[0]?.runs[0]?.pages[0]?.shot).toBeNull();
  });
});
