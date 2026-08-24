import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createFileBackedHostCheckpointClient,
  ensureHostCheckpointRoot,
} from "./preflight-reveal-host-checkpoint-client.ts";
import {
  canonicalHostCheckpointBytes,
  type HostCheckpointRequest,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import {
  request,
  requestBodyFor,
  response,
  responseFor,
} from "./preflight-reveal-host-checkpoint-test-fixture.ts";

const withArchive = async (
  name: string,
  callback: (archive: string, root: string) => Promise<void>,
): Promise<void> => {
  const archiveParent = path.resolve(
    process.cwd(),
    "..",
    "customreport-archive",
  );
  await mkdir(archiveParent, { recursive: true });
  const archive = await mkdtemp(
    path.join(archiveParent, `customreport-host-checkpoint-${name}-`),
  );
  try {
    await callback(archive, path.join(archive, "host-checkpoints"));
  } finally {
    await rm(archive, { recursive: true, force: true });
  }
};

const body = (): Omit<HostCheckpointRequest, "requestDigest"> => {
  const { requestDigest: _requestDigest, ...requestBody } = request;
  return requestBody;
};

describe("source-bound host checkpoint client", () => {
  it("requires an empty mode-0700 root and immutable mode-0600 mailbox files", async () => {
    await withArchive("root", async (archive, root) => {
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
      });
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      await writeFile(responsePath, canonicalHostCheckpointBytes(response), {
        mode: 0o600,
      });
      await chmod(responsePath, 0o600);
      await expect(
        client({ request: body(), signal: AbortSignal.timeout(20) }),
      ).rejects.toThrow();
      await expect(
        readFile(path.join(root, "HOST_CHECKPOINT_REQUEST.attempt-1.1.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        ensureHostCheckpointRoot({
          archiveRoot: archive,
          root: path.join(path.dirname(archive), "escaped"),
        }),
      ).rejects.toThrow();
      await symlink(root, path.join(archive, "link"));
      await expect(
        ensureHostCheckpointRoot({
          archiveRoot: archive,
          root: path.join(archive, "link"),
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects an already-aborted signal before establishing a watcher", async () => {
    await withArchive("abort", async (archive, root) => {
      let watchCalls = 0;
      let timerCalls = 0;
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        watchDirectory: () => {
          watchCalls += 1;
          return (async function* () {
            await Promise.resolve();
            yield undefined;
          })();
        },
        setTimer: () => {
          timerCalls += 1;
          return setTimeout(() => undefined, 10_000);
        },
        clearTimer: (timer) => clearTimeout(timer),
      });
      const controller = new AbortController();
      controller.abort(new Error("cancelled before watcher"));
      await expect(
        client({ request: body(), signal: controller.signal }),
      ).rejects.toThrow("cancelled before watcher");
      expect(watchCalls).toBe(0);
      expect(timerCalls).toBe(0);
    });
  });

  it("reads publication between watcher setup and the second read", async () => {
    await withArchive("between-read", async (archive, root) => {
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      let watchCalls = 0;
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        watchDirectory: async () => {
          watchCalls += 1;
          await writeFile(
            responsePath,
            canonicalHostCheckpointBytes(response),
            { mode: 0o600 },
          );
          return (async function* () {
            await Promise.resolve();
            yield undefined;
          })();
        },
      });
      await expect(client({ request: body() })).resolves.toEqual(response);
      expect(watchCalls).toBe(1);
    });
  });

  it("uses injected timer and cancellation seams", async () => {
    await withArchive("timeout", async (archive, root) => {
      let cleared = false;
      let closed = false;
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        watchDirectory: async function* (_directory, signal) {
          try {
            await new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), {
                once: true,
              }),
            );
            yield undefined;
          } finally {
            closed = true;
          }
        },
        setTimer: (callback) => {
          callback();
          return setTimeout(() => undefined, 10_000);
        },
        clearTimer: (timer) => {
          cleared = true;
          clearTimeout(timer);
        },
      });
      await expect(client({ request: body() })).rejects.toThrow(
        "Host checkpoint timed out",
      );
      expect(cleared).toBe(true);
      expect(closed).toBe(false);
    });
    await withArchive("cancel", async (archive, root) => {
      const controller = new AbortController();
      let cleared = false;
      let closed = false;
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        watchDirectory: async function* (_directory, signal) {
          try {
            await new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), {
                once: true,
              }),
            );
            yield undefined;
          } finally {
            closed = true;
          }
        },
        setTimer: () => setTimeout(() => undefined, 10_000),
        clearTimer: (timer) => {
          cleared = true;
          clearTimeout(timer);
        },
      });
      const pending = client({ request: body(), signal: controller.signal });
      setTimeout(() => controller.abort(new Error("parent cancelled")), 10);
      await expect(pending).rejects.toThrow("parent cancelled");
      expect(cleared).toBe(true);
      expect(closed).toBe(true);
    });
  });

  it("rejects a stale response published after the request", async () => {
    await withArchive("stale", async (archive, root) => {
      const staleRequest = requestBodyFor(request, { boundaryTimestamp: 300 });
      const staleResponse = responseFor(staleRequest, {
        controllerObservationTimestamp: 299,
        sampleTimestamp: 200,
      });
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        watchDirectory: async function* () {
          await writeFile(
            responsePath,
            canonicalHostCheckpointBytes(staleResponse),
            { mode: 0o600 },
          );
          yield undefined;
        },
      });
      const { requestDigest: _requestDigest, ...requestBody } = staleRequest;
      await expect(client({ request: requestBody })).rejects.toThrow(
        /predates the request boundary/u,
      );
    });
  });

  it("publishes one immutable request and accepts only its matching response", async () => {
    await withArchive("publish", async (archive, root) => {
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
      });
      const requestPath = path.join(
        root,
        "HOST_CHECKPOINT_REQUEST.attempt-1.1.json",
      );
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      const writer = (async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          try {
            await readFile(requestPath, "utf8");
            await writeFile(
              responsePath,
              canonicalHostCheckpointBytes(response),
              { mode: 0o600 },
            );
            return;
          } catch (error: unknown) {
            if (!(
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            ))
              throw error;
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }
        throw new Error("checkpoint request was not published");
      })();
      await expect(client({ request: body() })).resolves.toEqual(response);
      await writer;
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      expect((await stat(requestPath)).mode & 0o777).toBe(0o600);
      expect((await stat(responsePath)).mode & 0o777).toBe(0o600);
      await expect(client({ request: body() })).rejects.toThrow(
        /response already exists/u,
      );
    });
  });
});
