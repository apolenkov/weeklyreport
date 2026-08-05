import { expect, test } from "vitest";

import config from "./playwright.config.ts";

test("starts current-source servers without stale-server reuse", () => {
  const servers = config.webServer;
  if (!Array.isArray(servers)) {
    throw new TypeError("The UAT sweep requires API and web server entries");
  }

  const [apiServer, webServer] = servers;
  if (!apiServer || !webServer) {
    throw new TypeError("The UAT sweep server configuration is incomplete");
  }

  expect(apiServer.reuseExistingServer).toBe(false);
  expect(webServer.reuseExistingServer).toBe(false);
  expect(apiServer.command).toContain("src/main.ts");
  expect(webServer.command).toMatch(/next dev --webpack -p \d+$/);
});
