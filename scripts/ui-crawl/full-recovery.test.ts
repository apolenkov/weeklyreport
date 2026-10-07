import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { PressResult } from "./batch.ts";
import { parseCli } from "./config.ts";
import { crawlFullPages } from "./full.ts";
import type { FullControl, FullProbe } from "./full-probe.ts";
import type { Ctx } from "./logs.ts";

vi.mock("./rate.ts", () => ({ pace: () => 123, settleRate: vi.fn() }));

const url = "http://127.0.0.1:50123/fixture";
const output = join(
  import.meta.dirname,
  "../../output/crawl-full-recovery-tests",
);
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("full traversal after failed batch recovery", () => {
  it.each([false, true])(
    "retains completed evidence and stops dependent work (changed=%s)",
    (changed) => {
      mkdirSync(output, { recursive: true });
      const dir = mkdtempSync(join(output, "page-"));
      directories.push(dir);
      const control: FullControl = {
        selector: "#inspect",
        tag: "button",
        role: "button",
        name: "Inspect health",
        type: "button",
        href: null,
        disabled: false,
        bounds: { x: 0, y: 0, width: 100, height: 30 },
        clipped: false,
        obstructedBy: null,
        selected: false,
        alternatives: [],
        elementId: "inspect",
        row: null,
        surface: null,
        form: false,
        group: null,
        value: "",
        expanded: false,
        options: [],
      };
      const probe: FullProbe = {
        url,
        title: "Fixture",
        viewport: { width: 1280, height: 720 },
        links: [],
        geometry: [],
        controls: [
          control,
          {
            ...control,
            selector: "#next",
            name: "Inspect next",
            elementId: "next",
          },
        ],
        signature: "baseline",
        surface: null,
      };
      const completed: PressResult = {
        n: 0,
        status: "ok",
        before: `${url}|base`,
        after: `${url}|${changed ? "changed" : "base"}`,
        urlChanged: false,
        ms: 1,
        blockedMs: 0,
        logs: [{ kind: "console-warn", detail: "Observed before timeout" }],
      };
      let failed = false;
      let presses = 0;
      let unsafeScreenshots = 0;
      const ctx: Ctx = {
        config: {
          ...parseCli(["--url", "http://127.0.0.1:50123", "--no-video"]).config,
          mode: "full",
        },
        role: {
          name: "lead",
          email: "lead@fixture.local",
          passwordKey: "PW_LEAD1",
        },
        width: 1280,
        dir,
        findings: [],
        signIn: vi.fn(),
        browser: {
          session: "full-recovery",
          profile: new Map(),
          stalls: [],
          restarts: [],
          close: vi.fn(),
          batch: (commands) => {
            if (failed && commands[0]?.[0] === "screenshot")
              unsafeScreenshots++;
            if (failed && commands[0]?.[0] !== "dialog")
              throw new Error("SECONDARY restore failed");
            return commands.map(() => ({ ok: true, error: null, value: {} }));
          },
          evaluate: (source): unknown => {
            if (source.includes("sessionStorage.getItem"))
              return JSON.stringify([completed]);
            if (failed)
              throw new Error(
                "Unknown page must not be read after failed recovery",
              );
            if (source.includes("const items =")) {
              presses++;
              failed = true;
              throw new Error("PRIMARY timeout");
            }
            if (source === "location.pathname") return "/fixture";
            if (source.includes("const GEOM =")) return probe;
            if (source.includes("await axe.run")) return [];
            if (source.includes("const n = S.req")) return 0;
            return `${url}|base`;
          },
        },
      };

      const pages = crawlFullPages(ctx, url, "");

      expect(pages[0]?.steps[0]).toMatchObject({
        name: "Inspect health",
        responseMs: 1,
        logs: completed.logs,
      });
      expect(pages[0]?.completion).toBe("error");
      expect(presses).toBe(1);
      expect(unsafeScreenshots).toBe(0);
      expect(
        ctx.findings.some((f) => f.detail.includes("PRIMARY timeout")),
      ).toBe(true);
      expect(
        ctx.findings.some((f) => f.detail.includes("SECONDARY restore failed")),
      ).toBe(true);
    },
  );
});
