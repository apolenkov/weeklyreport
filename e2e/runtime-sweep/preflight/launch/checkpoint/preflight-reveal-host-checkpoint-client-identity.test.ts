import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import {
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
} from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import { parentReplayContextFor } from "../continuation/preflight-reveal-continuation-parent-replay.ts";
import { createFileBackedHostCheckpointClient } from "./preflight-reveal-host-checkpoint-client.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointResponse,
  type HostCheckpointRequest,
  hostRecordDigestFor,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import {
  baselineReceiptDigest,
  request,
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

describe("source-bound host checkpoint identity", () => {
  it("keeps canonical reducer state equal for uninterrupted and split receipts", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const result = await runChunk({
        source,
        state,
        route,
        root: inventoryFor([
          controlFor("button:a-open:0", "Open panel", 0),
          controlFor("button:b-open:0", "Open later", 1),
        ]),
        nested: inventoryFor([]),
        stableAllPostAction: inventoryFor([]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      const [first, second] = result.result.chunk.receipts;
      if (first === undefined || second === undefined)
        throw new Error("Fixture did not produce two receipts");
      const initialBranch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const all = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first, second],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const firstPart = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const split = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: firstPart.state,
        receipts: [second],
        predecessorCompletedCandidateCount: firstPart.completedCandidateCount,
        predecessorDigest: firstPart.receiptHead,
      });
      expect(reducerStateDigestFor(split.state)).toBe(
        reducerStateDigestFor(all.state),
      );
      expect(split.completedCandidateCount).toBe(all.completedCandidateCount);
      expect(split.receiptHead).toBe(all.receiptHead);
      expect(split.status).toBe(all.status);
    });
  });

  it.each([
    ["sourceSha", { sourceSha: "d".repeat(40) }],
    ["sourceTree", { sourceTree: "e".repeat(40) }],
    ["stateId", { stateId: "other-state" }],
    ["route", { route: "/other-route" }],
    ["profile", { profile: "other-profile" }],
    ["role", { role: "viewer" }],
    ["attemptId", { attemptId: "attempt-2" }],
  ] as const)(
    "rejects response run identity drift for %s",
    async (field, change) => {
      await withArchive(`identity-${field}`, async (archive, root) => {
        const valid = responseFor(request);
        const { responseDigest: _responseDigest, ...validBody } = valid;
        const changed = createHostCheckpointResponse({
          ...validBody,
          run: { ...validBody.run, ...change },
          hostRecordDigest: hostRecordDigestFor(validBody.sample),
        });
        const responsePath = path.join(
          root,
          "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
        );
        const client = await createFileBackedHostCheckpointClient({
          archiveRoot: archive,
          root,
          expectedBaselineReceiptDigest: baselineReceiptDigest,
          watchDirectory: async function* () {
            await writeFile(
              responsePath,
              canonicalHostCheckpointBytes(changed),
              {
                mode: 0o600,
              },
            );
            yield undefined;
          },
        });
        await expect(client({ request: body() })).rejects.toThrow(
          /identity mismatch/u,
        );
      });
    },
  );

  it("rejects a validly digested predecessor drift without writing outside the mailbox", async () => {
    await withArchive("predecessor-drift", async (archive, root) => {
      const valid = responseFor(request);
      const { responseDigest: _responseDigest, ...validBody } = valid;
      const changed = createHostCheckpointResponse({
        ...validBody,
        predecessorCheckpointDigest: "b".repeat(64),
        hostRecordDigest: hostRecordDigestFor(validBody.sample),
      });
      const responsePath = path.join(
        root,
        "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
      );
      const client = await createFileBackedHostCheckpointClient({
        archiveRoot: archive,
        root,
        expectedBaselineReceiptDigest: baselineReceiptDigest,
        watchDirectory: async function* () {
          await writeFile(responsePath, canonicalHostCheckpointBytes(changed), {
            mode: 0o600,
          });
          yield undefined;
        },
      });
      await expect(client({ request: body() })).rejects.toThrow(
        /predecessor mismatch/u,
      );
      await expect(
        readFile(
          path.join(
            path.dirname(root),
            "HOST_CHECKPOINT_RESPONSE.attempt-1.1.json",
          ),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("does not leak loser rejections when timeout or cancellation wins", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      await withArchive("unhandled-timeout", async (archive, root) => {
        const client = await createFileBackedHostCheckpointClient({
          archiveRoot: archive,
          root,
          expectedBaselineReceiptDigest: baselineReceiptDigest,
          watchDirectory: async function* (_directory, signal) {
            await new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), {
                once: true,
              }),
            );
            yield undefined;
          },
          setTimer: (callback) => {
            callback();
            return setTimeout(() => undefined, 10_000);
          },
          clearTimer: clearTimeout,
        });
        await expect(client({ request: body() })).rejects.toThrow(
          "Host checkpoint timed out",
        );
      });
      await withArchive("unhandled-cancel", async (archive, root) => {
        const controller = new AbortController();
        const client = await createFileBackedHostCheckpointClient({
          archiveRoot: archive,
          root,
          expectedBaselineReceiptDigest: baselineReceiptDigest,
          watchDirectory: async function* (_directory, signal) {
            await new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), {
                once: true,
              }),
            );
            yield undefined;
          },
        });
        const pending = client({
          request: body(),
          signal: controller.signal,
        });
        setTimeout(() => controller.abort(new Error("cancelled")), 0);
        await expect(pending).rejects.toThrow("cancelled");
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it.each(["../escape", ".."])(
    "rejects path-shaped attempt id %s before publishing any request",
    async (attemptId) => {
      await withArchive(
        `attempt-path-${attemptId.replaceAll(/[^a-z0-9-]/gu, "-")}`,
        async (archive, root) => {
          const client = await createFileBackedHostCheckpointClient({
            archiveRoot: archive,
            root,
            expectedBaselineReceiptDigest: baselineReceiptDigest,
          });
          const requestBody = {
            ...body(),
            run: { ...body().run, attemptId },
          };
          await expect(client({ request: requestBody })).rejects.toThrow();
          await expect(
            readFile(
              path.join(
                path.dirname(root),
                `HOST_CHECKPOINT_REQUEST.${attemptId}.1.json`,
              ),
            ),
          ).rejects.toMatchObject({ code: "ENOENT" });
          await expect(
            readFile(
              path.join(root, `HOST_CHECKPOINT_REQUEST.${attemptId}.1.json`),
            ),
          ).rejects.toMatchObject({ code: "ENOENT" });
        },
      );
    },
  );
});
