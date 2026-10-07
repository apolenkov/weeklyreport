import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadPasswords } from "./config.ts";
import { crawlFullPages } from "./full.ts";
import { drainLogs } from "./logs.ts";
import { crawlPages } from "./page.ts";
import { testContext } from "./test-context.fixture.ts";
import { login } from "./worker.ts";
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (args[0] === "/fixture/unreadable-secret")
        throw Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        });
      return actual.readFileSync(...args);
    },
  };
});
vi.mock("./rate.ts", () => ({
  pace: vi.fn(),
  settleRate: vi.fn(),
  configureRate: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
describe("crawler error ownership", () => {
  it("surfaces secret-file failures even when an environment password exists", () => {
    vi.stubEnv("PW_LEAD1", "fixture-private-value");
    try {
      expect(() => loadPasswords("/fixture/unreadable-secret")).toThrow(
        /unreadable-secret/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("uses the environment when the secret file is absent", () => {
    vi.stubEnv("PW_LEAD1", "fixture-value");
    try {
      expect(loadPasswords("/fixture/missing-secret").PW_LEAD1).toBe(
        "fixture-value",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("retains auth root cause and sleeps only between four attempts", () => {
    const ctx = testContext();
    const root = new Error("AUTH unavailable");
    vi.mocked(ctx.browser.batch).mockImplementation(() => {
      throw root;
    });
    const sleep = vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    let error: unknown;
    try {
      login(ctx.browser, ctx.config, ctx.role, "fixture-private-value");
    } catch (error_) {
      error = error_;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toBe(root);
    expect((error as Error).message).toContain("4 attempts");
    expect(sleep).toHaveBeenCalledTimes(3);
  });
  it("rejects failed auth commands even when the page path looks signed in", () => {
    const ctx = testContext();
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map(() => ({
        ok: false,
        error: "AUTH command failed",
        value: null,
      })),
    );
    vi.mocked(ctx.browser.evaluate).mockReturnValue("/fixture");
    vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    expect(() =>
      login(ctx.browser, ctx.config, ctx.role, "fixture-private-value"),
    ).toThrow("4 attempts");
  });
  it.each([crawlPages, crawlFullPages])(
    "keeps page and sign-in failures distinguishable (%s)",
    (crawl) => {
      const ctx = testContext();
      vi.mocked(ctx.browser.batch).mockImplementation(() => {
        throw new Error("PAGE unavailable");
      });
      vi.mocked(ctx.signIn).mockImplementation(() => {
        throw new Error("AUTH unavailable");
      });
      crawl(ctx, "http://127.0.0.1:50123/fixture", "");
      const detail = ctx.findings.map((f) => f.detail).join(" ");
      expect(detail).toContain("PAGE unavailable");
      expect(detail).toContain("AUTH unavailable");
    },
  );
  it("does not clear a source whose read failed and still delivers others", () => {
    const ctx = testContext();
    const cleared: string[] = [];
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map((command) => {
        const source = command[0];
        if (command.includes("--clear")) {
          cleared.push(source ?? "");
          return { ok: true, error: null, value: null };
        }
        return source === "console"
          ? { ok: false, error: "CONSOLE read unavailable", value: null }
          : {
              ok: true,
              error: null,
              value:
                source === "errors"
                  ? { errors: ["retained page failure"] }
                  : { requests: [] },
            };
      }),
    );
    drainLogs(ctx, { page: "/fixture", shot: null });
    expect(cleared).not.toContain("console");
    expect(cleared).toContain("errors");
    expect(
      ctx.findings.some((f) => f.detail.includes("CONSOLE read unavailable")),
    ).toBe(true);
    expect(
      ctx.findings.some((f) => f.detail.includes("retained page failure")),
    ).toBe(true);
  });
  it("reports clear failure after delivering the successfully read evidence", () => {
    const ctx = testContext();
    vi.mocked(ctx.browser.batch).mockImplementation((commands) =>
      commands.map((command) =>
        command.includes("--clear")
          ? { ok: false, error: "CLEAR unavailable", value: null }
          : {
              ok: true,
              error: null,
              value: {
                errors: ["observed failure"],
                requests: [],
                messages: [],
              },
            },
      ),
    );
    drainLogs(ctx, { page: "/fixture", shot: null });
    expect(
      ctx.findings.some((f) => f.detail.includes("CLEAR unavailable")),
    ).toBe(true);
    expect(
      ctx.findings.some((f) => f.detail.includes("observed failure")),
    ).toBe(true);
  });
});
