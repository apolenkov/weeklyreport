import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { startPersistentPreflightServers } from "./preflight-persistent-server-lease.ts";

const { healthMock, spawnMock } = vi.hoisted(() => ({
  healthMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("../launch/bounded/preflight-detached-process-group.ts", async () => {
  const actual = await vi.importActual<
    typeof import("../launch/bounded/preflight-detached-process-group.ts")
  >("../launch/bounded/preflight-detached-process-group.ts");
  return { ...actual, spawnDetachedProcessGroup: spawnMock };
});

vi.mock("./preflight-persistent-server-lease-probes.ts", async () => {
  const actual = await vi.importActual<
    typeof import("./preflight-persistent-server-lease-probes.ts")
  >("./preflight-persistent-server-lease-probes.ts");
  return { ...actual, waitForPersistentServerHealth: healthMock };
});

describe("persistent preflight server startup cancellation", () => {
  it("stops after an aborted API health wait and closes only the started API group", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".persistent-lease-startup-abort-"),
    );
    const controller = new AbortController();
    const abortReason = new Error("startup aborted during API health");
    const apiHandle = {
      ownership: {
        pid: 1001,
        pgid: 1001,
        uid: 501,
        startToken: "api-start",
      },
      close: vi.fn().mockResolvedValue(undefined),
    };
    spawnMock.mockReset().mockResolvedValue(apiHandle);
    healthMock
      .mockReset()
      .mockImplementationOnce((_server: unknown, signal?: AbortSignal) => {
        controller.abort(abortReason);
        return Promise.reject(signal?.aborted ? signal.reason : abortReason);
      });
    try {
      await expect(
        startPersistentPreflightServers({
          repoRoot: process.cwd(),
          archiveRoot,
          source: {} as never,
          attemptId: "attempt-startup-abort",
          environment: {
            E2E_API_PORT: "3102",
            E2E_DATABASE_URL: "postgresql://localhost/customreport_e2e",
            E2E_WEB_PORT: "3105",
            npm_execpath: "/usr/bin/pnpm",
          },
          signal: controller.signal,
        }),
      ).rejects.toBe(abortReason);
      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operationName: "Persistent preflight api server",
        }),
      );
      expect(healthMock).toHaveBeenCalledTimes(1);
      expect(apiHandle.close).toHaveBeenCalledTimes(1);
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });
});
