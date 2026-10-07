import { execFileSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import { createBrowser } from "./driver.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

describe("browser close", () => {
  it("reports failed closure with its session and original cause", () => {
    const cause = Object.assign(new Error("CLI close exited with 9"), {
      status: 9,
    });
    vi.mocked(execFileSync).mockReturnValueOnce("cleanup-test\n");
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw cause;
    });

    const browser = createBrowser("lead");
    expect.assertions(2);
    try {
      browser.close();
    } catch (error) {
      expect(error).toHaveProperty(
        "message",
        "Failed to close browser session cleanup-test",
      );
      expect(error).toHaveProperty("cause", cause);
    }
  });
});
