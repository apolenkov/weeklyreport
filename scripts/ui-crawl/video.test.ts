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

import { createBrowser } from "./driver.ts";
import { mergeReports } from "./merge.ts";
import { renderMarkdown } from "./report.ts";
import { testContext } from "./test-context.fixture.ts";
import { crawlRole } from "./worker.ts";
vi.mock("./driver.ts", () => ({ createBrowser: vi.fn() }));
vi.mock("./rate.ts", () => ({
  pace: () => 123,
  settleRate: vi.fn(),
  configureRate: vi.fn(),
}));
const root = join(import.meta.dirname, "../../output/crawl-video-tests");
const dirs: string[] = [];
afterEach(() => {
  vi.clearAllMocks();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function run(video: boolean, failure: string | null) {
  mkdirSync(root, { recursive: true });
  const out = mkdtempSync(join(root, "run-"));
  dirs.push(out);
  const ctx = testContext();
  vi.mocked(createBrowser).mockReturnValue(ctx.browser);
  const commandsSeen: string[][] = [];
  let destination: string | null = null;
  vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
    commands.map((command) => {
      if (command[0] === "record") {
        commandsSeen.push([...command]);
        if (failure !== null && command[1] === failure)
          return {
            ok: false,
            error: `RECORD ${failure} unavailable`,
            value: null,
          };
        if (command[1] === "start") destination = command[2] ?? null;
        if (command[1] === "stop" && destination)
          writeFileSync(destination, "fixture recorded video");
      }
      return { ok: true, error: null, value: {} };
    }),
  );
  vi.mocked(ctx.browser.evaluate).mockImplementation((source): unknown =>
    source === "location.pathname"
      ? "/fixture"
      : source === "location.href"
        ? "http://127.0.0.1:50123/fixture"
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
              : "base",
  );
  const runs = crawlRole(
    { ...ctx.config, out, widths: [1280], video },
    ctx.role,
    "fixture-password",
  );
  return { runs, out, commandsSeen };
}
describe("crawler video evidence", () => {
  it("preserves absent video through merged reports", () => {
    const { runs, out } = run(false, null);
    const part = join(out, "state-fixture", "pass");
    mkdirSync(part, { recursive: true });
    writeFileSync(
      join(part, "report.json"),
      JSON.stringify({
        url: "http://127.0.0.1:50123",
        started: "fixture",
        wallMs: 0,
        results: [{ role: "lead", ms: 0, runs }],
      }),
    );
    expect(mergeReports(out)).toEqual({ passes: 1, missing: [] });
    const merged = JSON.parse(
      readFileSync(join(out, "report.json"), "utf8"),
    ) as { results: { runs: { video: string | null }[] }[] };
    expect(merged.results[0]?.runs[0]?.video).toBeNull();
  });
  it("returns no video and records nothing when disabled", () => {
    const { runs, commandsSeen } = run(false, null);
    expect(runs[0]?.video).toBeNull();
    expect(commandsSeen).toEqual([]);
    expect(
      renderMarkdown(
        {
          url: "http://127.0.0.1:50123",
          wallMs: 0,
          started: "fixture",
          parallel: 1,
        },
        [{ role: "lead", ms: 0, runs }],
      ),
    ).toContain("| none |");
  });
  it.each(["start", "stop"])(
    "does not claim video when record %s fails",
    (failure) => {
      const { runs } = run(true, failure);
      expect(runs[0]?.video).toBeNull();
      expect(
        runs[0]?.findings.some((f) =>
          f.detail.includes(`RECORD ${failure} unavailable`),
        ),
      ).toBe(true);
    },
  );
  it("returns an existing relative video only after a successful recording", () => {
    const { runs, out } = run(true, null);
    const video = runs[0]?.video;
    expect(video).toBe("video/lead-1280.webm");
    if (!video) throw new Error("Missing video");
    expect(existsSync(join(out, video))).toBe(true);
  });
});
