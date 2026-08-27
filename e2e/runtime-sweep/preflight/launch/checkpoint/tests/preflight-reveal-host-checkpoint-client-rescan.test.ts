import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createFileBackedHostCheckpointClient } from "../preflight-reveal-host-checkpoint-client.ts";
import { waitForHostCheckpointResponse } from "../preflight-reveal-host-checkpoint-client-wait.ts";
import {
  canonicalHostCheckpointBytes,
  type HostCheckpointRequest,
  parseCanonicalHostCheckpointRequest,
} from "../preflight-reveal-host-checkpoint-contract.ts";
import {
  baselineReceiptDigest,
  request,
  requestBodyFor,
  response,
  responseFor,
} from "../preflight-reveal-host-checkpoint-test-fixture.ts";

const withArchive = async (
  callback: (archive: string, root: string) => Promise<void>,
): Promise<void> => {
  const archiveParent = path.resolve(
    process.cwd(),
    "..",
    "customreport-archive",
  );
  await mkdir(archiveParent, { recursive: true });
  const archive = await mkdtemp(
    path.join(archiveParent, "customreport-host-checkpoint-rescan-"),
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

const digestFor = (value: number): string =>
  "a".repeat(63) + String(value % 10);

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("source-bound host checkpoint response rescan", () => {
  it("finds a response when its watcher event is lost", async () => {
    await withArchive(async (archive, root) => {
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      let watcherClosed = false;
      let watcherStartedResolve: (() => void) | undefined;
      const watcherStarted = new Promise<void>((resolve) => {
        watcherStartedResolve = resolve;
      });
      const writer = (async (): Promise<void> => {
        await watcherStarted;
        await new Promise((resolve) => setTimeout(resolve, 25));
        await writeFile(responsePath, canonicalHostCheckpointBytes(response), {
          mode: 0o600,
        });
      })();
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        expectedBaselineReceiptDigest: baselineReceiptDigest,
        watchDirectory: async function* () {
          watcherStartedResolve?.();
          await Promise.resolve();
          yield undefined;
          watcherClosed = true;
        },
      });
      await expect(
        client({ request: body(), signal: AbortSignal.timeout(2000) }),
      ).resolves.toEqual(response);
      await writer;
      expect(watcherClosed).toBe(true);
      await expect(readFile(responsePath, "utf8")).resolves.toBe(
        canonicalHostCheckpointBytes(response),
      );
    });
  });

  it("keeps finding lost events through a fourteen-checkpoint chain", async () => {
    await withArchive(async (archive, root) => {
      let previousResponseDigest: string | null = null;
      let watcherStartedResolve: (() => void) | undefined;
      let watcherStarted: Promise<void> = Promise.resolve();
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        expectedBaselineReceiptDigest: baselineReceiptDigest,
        watchDirectory: async function* () {
          watcherStartedResolve?.();
          await Promise.resolve();
          yield undefined;
        },
      });
      for (let sequence = 1; sequence <= 14; sequence += 1) {
        watcherStarted = new Promise<void>((resolve) => {
          watcherStartedResolve = resolve;
        });
        const checkpointRequest = requestBodyFor(request, {
          checkpointSequence: sequence,
          completedChildOrdinal: sequence - 1,
          boundaryTimestamp: 100 + sequence,
          receiptHead: digestFor(sequence),
          receiptCount: sequence,
          chunkHead: digestFor(sequence + 20),
          chunkCount: sequence,
          completedCandidateCount: sequence,
          previousCheckpointDigest: previousResponseDigest,
          previousSampleSequence: sequence === 1 ? null : 60,
        });
        const requestPath = path.join(
          root,
          `HOST_CHECKPOINT_REQUEST.attempt-1.${String(sequence)}.json`,
        );
        const responsePath = path.join(
          root,
          `HOST_CHECKPOINT_RESPONSE.attempt-1.${String(sequence)}.json`,
        );
        const expectedResponse = responseFor(checkpointRequest, {
          controllerObservationTimestamp: 300 + sequence,
          sampleTimestamp: 400 + sequence,
        });
        const writer = (async (): Promise<void> => {
          await watcherStarted;
          await wait(25);
          for (let attempt = 0; attempt < 100; attempt += 1) {
            try {
              const storedRequest = parseCanonicalHostCheckpointRequest(
                await readFile(requestPath, "utf8"),
              );
              const storedResponse = responseFor(storedRequest, {
                controllerObservationTimestamp: 300 + sequence,
                sampleTimestamp: 400 + sequence,
              });
              await writeFile(
                responsePath,
                canonicalHostCheckpointBytes(storedResponse),
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
              await wait(5);
            }
          }
          throw new Error("checkpoint request was not published");
        })();
        const { requestDigest: _requestDigest, ...requestBody } =
          checkpointRequest;
        await expect(
          client({ request: requestBody, signal: AbortSignal.timeout(2000) }),
        ).resolves.toEqual(expectedResponse);
        await writer;
        previousResponseDigest = expectedResponse.responseDigest;
        watcherStartedResolve = undefined;
      }
    });
  });

  it("does not keep rescanning after a response settles", async () => {
    await withArchive(async (_archive, root) => {
      let reads = 0;
      const result = await waitForHostCheckpointResponse({
        filePath: path.join(root, "response.json"),
        watchDirectory: async function* (_directory, signal) {
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
          yield undefined;
        },
        setTimer: setTimeout,
        clearTimer: clearTimeout,
        readResponse: () => {
          reads += 1;
          return Promise.resolve(reads >= 4 ? response : undefined);
        },
      });
      const readsAtResolution = reads;
      await wait(350);
      expect(result).toEqual(response);
      expect(readsAtResolution).toBe(4);
      expect(reads).toBe(readsAtResolution);
    });
  });

  it("stops a pending rescan after cancellation", async () => {
    await withArchive(async (_archive, root) => {
      const controller = new AbortController();
      let reads = 0;
      let watcherStartedResolve: (() => void) | undefined;
      const watcherStarted = new Promise<void>((resolve) => {
        watcherStartedResolve = resolve;
      });
      const pending = waitForHostCheckpointResponse({
        filePath: path.join(root, "response.json"),
        signal: controller.signal,
        watchDirectory: async function* (_directory, signal) {
          watcherStartedResolve?.();
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
          yield undefined;
        },
        setTimer: setTimeout,
        clearTimer: clearTimeout,
        readResponse: () => {
          reads += 1;
          return Promise.resolve(undefined);
        },
      });
      await watcherStarted;
      controller.abort(new Error("cancelled"));
      await expect(pending).rejects.toThrow("cancelled");
      const readsAfterCancellation = reads;
      await wait(350);
      expect(reads).toBe(readsAfterCancellation);
    });
  });
});
