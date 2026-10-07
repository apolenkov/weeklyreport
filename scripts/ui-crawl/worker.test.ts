import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCli } from "./config.ts";
import type { Config, Role } from "./types.ts";
import { crawlRole } from "./worker.ts";

const transport = vi.hoisted(() => ({
  batch: vi.fn(),
  evaluate: vi.fn(),
  close: vi.fn(),
  pages: vi.fn(),
}));

vi.mock("./driver.ts", () => ({
  createBrowser: () => ({
    ...transport,
    session: "cleanup-test",
    profile: new Map(),
    stalls: [],
    restarts: [],
  }),
}));
vi.mock("./page.ts", () => ({ crawlPages: transport.pages }));
vi.mock("./rate.ts", () => ({ configureRate: vi.fn(), pace: () => 0 }));

const output = join(import.meta.dirname, "../../output/crawl-cleanup-tests");
mkdirSync(output, { recursive: true });
const fixtures: string[] = [];
const lead: Role = {
  name: "lead",
  email: "lead@fixture.local",
  passwordKey: "PW_LEAD1",
};

function fixture(): Config {
  const out = mkdtempSync(join(output, "role-"));
  fixtures.push(out);
  return parseCli([
    "--url",
    "http://127.0.0.1:50123",
    "--out",
    out,
    "--widths",
    "1280",
    "--no-video",
  ]).config;
}

beforeEach(() => {
  vi.resetAllMocks();
  transport.pages.mockReturnValue([]);
  transport.evaluate.mockImplementation((source: string) =>
    source === "location.href" ? "http://127.0.0.1:50123/lead" : "/lead",
  );
});
afterEach(() => {
  for (const dir of fixtures.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("crawlRole cleanup", () => {
  it("attempts browser closure even when writing the profile fails", () => {
    const config = fixture();
    mkdirSync(join(config.out, "profile-lead.json"));

    expect(() => crawlRole(config, lead, "synthetic-password")).toThrow();
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("keeps the crawl failure when profile and close also fail", () => {
    const config = fixture();
    const primary = new Error("PRIMARY crawl failure");
    const close = new Error("SECONDARY close failure");
    mkdirSync(join(config.out, "profile-lead.json"));
    transport.pages.mockImplementation(() => {
      throw primary;
    });
    transport.close.mockImplementation(() => {
      throw close;
    });

    expect.assertions(4);
    try {
      crawlRole(config, lead, "synthetic-password");
    } catch (error) {
      expect(error).toHaveProperty("suppressed", primary);
      expect(error).toHaveProperty("error.error", close);
      expect(error).toHaveProperty("error.suppressed.code", "EISDIR");
    }
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("fails an otherwise successful role when closure fails", () => {
    const close = new Error("close failed");
    transport.close.mockImplementation(() => {
      throw close;
    });

    expect(() => crawlRole(fixture(), lead, "synthetic-password")).toThrow(
      close,
    );
  });
});
