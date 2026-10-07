import { vi } from "vitest";

import { parseCli } from "./config.ts";
import type { Ctx } from "./logs.ts";
export function testContext(): Ctx {
  return {
    browser: {
      session: "fixture",
      profile: new Map(),
      stalls: [],
      restarts: [],
      close: vi.fn(),
      batch: vi.fn(() => []),
      evaluate: vi.fn(),
    },
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
