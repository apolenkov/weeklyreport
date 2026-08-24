import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
} from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import {
  canonicalHostCheckpointBytes,
  createHostCheckpointRequest,
  type HostCheckpointRequest,
  parseCanonicalHostCheckpointResponse,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import { runHostCheckpointController } from "./preflight-reveal-host-checkpoint-controller.ts";

const sourceSha = "a".repeat(40);
const sourceTree = "b".repeat(40);
const digest = "c".repeat(64);
const baselineReceiptDigest = "d".repeat(64);
const run = {
  campaignId: "controller-campaign",
  sourceSha,
  sourceTree,
  treeDigest: digest,
  sourceDigest: digest,
  planDigest: digest,
  attemptId: "attempt-controller",
  stateId: "state-admin-demo",
  stateDigest: digest,
  profile: "demo",
  role: "admin",
  route: "admin:/admin",
  routeDigest: digest,
} as const;

const baselineSnapshot = (): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: 150,
  phase: "post-infrastructure",
  rawFreeBytes: 0,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes: 256 * 1024 ** 2,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100,
  pageouts: 10,
  swapins: 20,
  swapouts: 30,
});

const baseline = {
  manifestPath: "/archive/baseline/host-pressure-manifest.json",
  recordsPath: "/archive/baseline/host-pressure.jsonl",
  recordCount: 60 as const,
  payloadBytes: 1,
  baselineReceiptDigest,
  lastSnapshot: baselineSnapshot(),
  lastCounters: {
    pageins: 100,
    pageouts: 10,
    swapins: 20,
    swapouts: 30,
  } satisfies DiagnosticHostEnvelopeCounters,
};

const controllerIdentity = {
  sourceSha,
  sourceTree,
  campaignId: run.campaignId,
  treeDigest: run.treeDigest,
  sourceDigest: run.sourceDigest,
  planDigest: run.planDigest,
  stateId: run.stateId,
  stateDigest: run.stateDigest,
  profile: run.profile,
  role: run.role,
  route: run.route,
  routeDigest: run.routeDigest,
} as const;

const requestBodyFor = (overrides: Partial<HostCheckpointRequest> = {}) => {
  const body = {
    artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
    version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
    run,
    checkpointSequence: 1,
    completedChildOrdinal: 0,
    boundaryTimestamp: 100,
    receiptHead: digest,
    receiptCount: 1,
    chunkHead: digest,
    chunkCount: 1,
    completedCandidateCount: 1,
    previousCheckpointDigest: null,
    previousSampleSequence: null,
    ...overrides,
  };
  const { requestDigest: _requestDigest, ...requestBody } =
    body as HostCheckpointRequest;
  return requestBody;
};

const responsePathFor = (
  root: string,
  request: HostCheckpointRequest,
): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_RESPONSE.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

const requestPathFor = (root: string, request: HostCheckpointRequest): string =>
  path.join(
    root,
    `HOST_CHECKPOINT_REQUEST.${request.run.attemptId}.${String(request.checkpointSequence)}.json`,
  );

const writeRequest = async (
  root: string,
  body: Omit<HostCheckpointRequest, "requestDigest">,
): Promise<HostCheckpointRequest> => {
  const request = createHostCheckpointRequest(body);
  await writeFile(
    requestPathFor(root, request),
    canonicalHostCheckpointBytes(request),
    { mode: 0o600 },
  );
  return request;
};

const waitForFile = async (filePath: string): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await stat(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
};

const withMailbox = async (
  callback: (archiveRoot: string, mailboxRoot: string) => Promise<void>,
): Promise<void> => {
  const archiveRoot = await mkdtemp(
    path.join(process.cwd(), ".host-controller-"),
  );
  const mailboxRoot = path.join(archiveRoot, "mailbox");
  await mkdir(mailboxRoot, { mode: 0o700 });
  await chmod(mailboxRoot, 0o700);
  try {
    await callback(archiveRoot, mailboxRoot);
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
};

const healthySnapshotFor = (
  timestampWall: number,
  counterOffset: number,
): DiagnosticHostEnvelopeSnapshot => ({
  ...baselineSnapshot(),
  timestampWall,
  phase: "runtime",
  pageins: 101 + counterOffset,
  pageouts: 11 + counterOffset,
  swapins: 21 + counterOffset,
  swapouts: 31 + counterOffset,
});

describe("source-bound external host checkpoint controller", () => {
  it("handles two sequential checkpoints, including scan-before-watch", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      let readCount = 0;
      const controller = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 2,
        readSnapshot: () => {
          readCount += 1;
          return Promise.resolve(
            healthySnapshotFor(readCount === 1 ? 200 : 400, readCount - 1),
          );
        },
      });
      const exhausted = expect(controller).rejects.toThrow(
        /exhausted.*terminal completion/u,
      );
      const first = await writeRequest(mailboxRoot, requestBodyFor());
      await waitForFile(responsePathFor(mailboxRoot, first));
      const firstResponse = parseCanonicalHostCheckpointResponse(
        await readFile(responsePathFor(mailboxRoot, first), "utf8"),
      );
      expect(firstResponse.sample.eventSequence).toBe(61);
      expect(firstResponse.baselineReceiptDigest).toBe(baselineReceiptDigest);
      const second = await writeRequest(
        mailboxRoot,
        requestBodyFor({
          checkpointSequence: 2,
          completedChildOrdinal: 1,
          boundaryTimestamp: 300,
          receiptHead: "e".repeat(64),
          receiptCount: 2,
          chunkHead: "f".repeat(64),
          chunkCount: 2,
          previousCheckpointDigest: firstResponse.responseDigest,
          previousSampleSequence: 61,
          completedCandidateCount: 2,
        }),
      );
      await waitForFile(responsePathFor(mailboxRoot, second));
      const secondResponse = parseCanonicalHostCheckpointResponse(
        await readFile(responsePathFor(mailboxRoot, second), "utf8"),
      );
      expect(secondResponse.sample.eventSequence).toBe(62);
      await writeRequest(
        mailboxRoot,
        requestBodyFor({
          checkpointSequence: 3,
          completedChildOrdinal: 2,
          boundaryTimestamp: 500,
          receiptHead: "1".repeat(64),
          receiptCount: 3,
          chunkHead: "2".repeat(64),
          chunkCount: 3,
          previousCheckpointDigest: secondResponse.responseDigest,
          previousSampleSequence: 62,
          completedCandidateCount: 3,
        }),
      );
      await exhausted;
      expect(
        (await stat(responsePathFor(mailboxRoot, second))).mode & 0o777,
      ).toBe(0o600);
    });
  });

  it("fails closed before publication on source drift, stale samples, and immediate pressure breach", async () => {
    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const sourceDrift = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 1,
        readSnapshot: () => Promise.resolve(healthySnapshotFor(200, 0)),
      });
      const foreignRun = { ...run, sourceSha: "9".repeat(40) };
      await writeRequest(mailboxRoot, requestBodyFor({ run: foreignRun }));
      await expect(sourceDrift).rejects.toThrow(/identity drifted/u);
      await expect(
        stat(
          path.join(
            mailboxRoot,
            "HOST_CHECKPOINT_RESPONSE.attempt-controller.1.json",
          ),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });

    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const stale = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 1,
        readSnapshot: () => Promise.resolve(healthySnapshotFor(100, 0)),
      });
      await writeRequest(mailboxRoot, requestBodyFor());
      await expect(stale).rejects.toThrow(/predates/u);
    });

    await withMailbox(async (archiveRoot, mailboxRoot) => {
      const breach = runHostCheckpointController({
        archiveRoot,
        mailboxRoot,
        ...controllerIdentity,
        baseline,
        maxCheckpoints: 1,
        readSnapshot: () =>
          Promise.resolve({
            ...healthySnapshotFor(200, 0),
            pressureState: "critical",
          }),
      });
      await writeRequest(mailboxRoot, requestBodyFor());
      await expect(breach).rejects.toThrow(/envelope breach/u);
    });
  });
});
