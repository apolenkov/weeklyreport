import { writeFile } from "node:fs/promises";

import type { TestInfo } from "@playwright/test";

import { inventoryDom } from "../replay/dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import type {
  ExpectedFault,
  NetworkEvidencePolicy,
  ResponseRecord,
} from "./evidence-types.ts";

const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";
const CAPTURED_AT = "2026-08-07T00:00:00.000Z";

export const captureNetwork = async (
  page: Parameters<typeof inventoryDom>[0],
  testInfo: TestInfo,
  responses: readonly ResponseRecord[],
  expectedFault?: ExpectedFault,
  networkPolicy?: NetworkEvidencePolicy,
  serverLogPath?: string,
  settleRuntimeEvents?: () => Promise<void>,
) =>
  captureRouteEvidence({
    page,
    archiveRoot: testInfo.outputPath("archive"),
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "viewer",
    catalogRoute: "/harness",
    resolvedRoute: "/harness",
    cellId: "network-cell",
    inventory: await inventoryDom(page),
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    responses,
    ...(expectedFault === undefined ? {} : { expectedFault }),
    ...(networkPolicy === undefined ? {} : { networkPolicy }),
    ...(serverLogPath === undefined
      ? {}
      : {
          serverLogPath,
          phaseStartedAt: CAPTURED_AT,
        }),
    ...(settleRuntimeEvents === undefined ? {} : { settleRuntimeEvents }),
    responseStatus: 200,
    capturedAt: CAPTURED_AT,
  });

export const responseRecord = (
  operation: string,
  overrides: Partial<ResponseRecord> = {},
): ResponseRecord => ({
  url: `/trpc/${operation}`,
  method: "POST",
  resourceType: "fetch",
  status: 200,
  ok: true,
  startedAt: CAPTURED_AT,
  endedAt: "2026-08-07T00:00:00.100Z",
  durationMs: 100,
  correlationId: "runtime-network-test",
  ...overrides,
});

export const errorResponse = (operation: string): ResponseRecord =>
  responseRecord(operation, { status: 500, ok: false });

export const controlledFault: ExpectedFault = {
  faultId: "publish-http-5xx",
  operation: "period.publish",
  method: "POST",
  expectedStatus: 500,
  expectedTransportFailure: null,
  expectedCount: 1,
};

export const networkOutcome = (
  result: Awaited<ReturnType<typeof captureNetwork>>,
): string | undefined =>
  result.bundle.observations.find(
    ({ observationId }) => observationId === "network",
  )?.outcome;

export const writeServerLog = async (
  testInfo: TestInfo,
  record: Readonly<Record<string, string>>,
): Promise<string> => {
  const logPath = testInfo.outputPath("app.log");
  await writeFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return logPath;
};
