import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { vi } from "vitest";

import type { CoverageCell } from "../source/contracts.ts";
import { sha256Bytes } from "./driver-results-transcript.ts";
import type { ImportOptions } from "./import-ai-driver-options.ts";

const SOURCE_SHA_LENGTH = 40;
const API_TOKEN_LENGTH = 40;
const BUGSINK_PROJECT_READ_LIMIT = 64;
const REPORT_ROUTE = "/lead/report";
const RUNTIME_SWEEP_NAME = "runtime-sweep";
const TRANSCRIPT_TIMESTAMP = "2026-08-05T00:00:30.000Z";

export const SOURCE_SHA = "a".repeat(SOURCE_SHA_LENGTH);
type BugsinkProjectResponse = Readonly<{
  readonly slug: string;
  readonly digested_event_count: number;
  readonly stored_event_count: number;
}>;
const EMPTY_BUGSINK_PROJECT: BugsinkProjectResponse = {
  slug: RUNTIME_SWEEP_NAME,
  digested_event_count: 0,
  stored_event_count: 0,
};
const action = {
  controlKey: "save",
  operation: "click" as const,
  safety: "reversible" as const,
  transition: "none" as const,
};

export const cell = (cellId = "cell-a"): CoverageCell => ({
  cellId,
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: REPORT_ROUTE,
  resolvedRoute: REPORT_ROUTE,
  viewport: { browser: "chromium", width: 1440, height: 900 },
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  action,
  execution: { kind: "control", action },
  faultId: null,
  oracle: {
    domainSpecRefs: ["exhaustive-runtime-sweep"],
    function: { required: true, expectation: "the action succeeds" },
    accessibility: { required: true, expectation: "the control is named" },
    visual: { required: true, expectation: "the layout is stable" },
    runtime: { required: true, expectation: "runtime telemetry is clean" },
  },
  controls: [],
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pending",
});

export const report = (
  candidate = false,
  cellId = "cell-a",
  candidateId = `candidate-${cellId}`,
) => ({
  provider: "native-codex",
  model: "gpt-5.6-luna",
  reasoning: "max",
  attemptId: `attempt-${cellId}`,
  transcriptEvidence: {
    status: "captured" as const,
    evidenceRefs: [`transcript:${cellId}`],
    digest: sha256Bytes(Buffer.from(`${transcriptForCell(cellId)}\n`, "utf8")),
  },
  roleDriven: "lead",
  profile: "minimal",
  sourceSha: SOURCE_SHA,
  assignedCells: [
    {
      cellId,
      catalogRoute: REPORT_ROUTE,
      resolvedRoute: REPORT_ROUTE,
      actionKey: "save",
    },
  ],
  routesVisited: 1,
  routesPlanned: 1,
  canary: { injected: true, detected: true },
  timeline: {
    startedAt: "2026-08-05T00:00:00.000Z",
    endedAt: "2026-08-05T00:01:00.000Z",
    routes: [
      {
        route: REPORT_ROUTE,
        enteredAt: "2026-08-05T00:00:01.000Z",
        leftAt: "2026-08-05T00:00:59.000Z",
      },
    ],
  },
  controlResults: [
    {
      cellId,
      controlKey: "save",
      status: "covered" as const,
      result: "pass" as const,
      evidenceRefs: ["control-evidence"],
    },
  ],
  candidates: candidate
    ? [
        {
          candidateId,
          cellId,
          controlKey: "save",
          kind: "functional" as const,
          summary: "candidate finding",
          evidenceRefs: ["candidate-evidence"],
        },
      ]
    : [],
});

export const options = (
  reportPaths: readonly string[],
  cellsPath: string,
  outputPath: string,
  transcriptPath: string,
  verificationPath?: string,
): ImportOptions => ({
  reportPaths,
  cellsPath,
  outputPath,
  transcriptPaths: [transcriptPath],
  ...(verificationPath ? { verificationPath } : {}),
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
});

export const writeJson = (filePath: string, value: unknown): Promise<void> =>
  writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");

export const transcriptForCell = (cellId: string): string =>
  [
    JSON.stringify({
      attemptId: `attempt-${cellId}`,
      timestamp: TRANSCRIPT_TIMESTAMP,
      tool: "browser_console_messages",
      route: REPORT_ROUTE,
    }),
    JSON.stringify({
      attemptId: `attempt-${cellId}`,
      timestamp: TRANSCRIPT_TIMESTAMP,
      tool: "browser_network_requests",
      route: REPORT_ROUTE,
    }),
  ].join("\n");

export const liveTranscript = transcriptForCell("cell-a");

const bugsinkProjectResponseStream =
  (): IterableIterator<BugsinkProjectResponse> =>
    Array.from(
      { length: BUGSINK_PROJECT_READ_LIMIT },
      (_, index): readonly [BugsinkProjectResponse, BugsinkProjectResponse] => [
        {
          slug: RUNTIME_SWEEP_NAME,
          digested_event_count: index,
          stored_event_count: index,
        },
        {
          slug: RUNTIME_SWEEP_NAME,
          digested_event_count: index + 1,
          stored_event_count: index + 1,
        },
      ],
    )
      .flat()
      .values();

const requestUrl = (input: RequestInfo | URL): URL =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

const storeReceipt = (body: BodyInit | null | undefined): Response => {
  const parsed =
    typeof body === "string" ? (JSON.parse(body) as { event_id?: string }) : {};
  return new Response(JSON.stringify({ id: parsed.event_id }), { status: 200 });
};

const lokiQueryResponse = (url: URL): Response => {
  const probeId = url.searchParams.get("query")?.match(/"([^"]+)"/u)?.[1];
  return new Response(
    JSON.stringify({
      status: "success",
      data: {
        result: [{ values: [["0", `runtime-sweep-probe ${probeId ?? ""}`]] }],
      },
    }),
    { status: 200 },
  );
};

const stubLiveFetch = (): void => {
  const projectResponses = bugsinkProjectResponseStream();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (url.pathname.includes("/canonical/0/projects/")) {
        const nextProject = projectResponses.next();
        const projectResponse = nextProject.done
          ? EMPTY_BUGSINK_PROJECT
          : nextProject.value;
        return Promise.resolve(
          new Response(JSON.stringify(projectResponse), { status: 200 }),
        );
      }
      if (url.pathname.endsWith("/store/"))
        return Promise.resolve(storeReceipt(init?.body));
      if (url.pathname.endsWith("/push"))
        return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(lokiQueryResponse(url));
    }),
  );
};

export const setLiveEnvironment = async (
  directory: string,
  apiLog = `${JSON.stringify({
    timestamp: "2026-08-05T00:00:30.000Z",
    level: "info",
    message: "live stream",
    correlationId: RUNTIME_SWEEP_NAME,
  })}\n`,
  cellId = "cell-a",
): Promise<string> => {
  const transcriptPath = path.join(directory, "transcript.jsonl");
  const apiLogPath = path.join(directory, "api-log", "app.log");
  await mkdir(path.dirname(apiLogPath), { recursive: true });
  await writeFile(transcriptPath, `${transcriptForCell(cellId)}\n`, "utf8");
  await writeFile(apiLogPath, apiLog, "utf8");
  process.env.RUNTIME_SWEEP_API_LOG = apiLogPath;
  process.env.RUNTIME_SWEEP_BUGSINK_DSN = "http://public@example.test/1";
  process.env.RUNTIME_SWEEP_BUGSINK_API_TOKEN = "a".repeat(API_TOKEN_LENGTH);
  process.env.RUNTIME_SWEEP_LOKI_PUSH_URL = "http://loki.test/push";
  process.env.RUNTIME_SWEEP_LOKI_QUERY_URL = "http://loki.test/query";
  stubLiveFetch();
  return transcriptPath;
};

export const clearLiveEnvironment = (): void => {
  delete process.env.RUNTIME_SWEEP_API_LOG;
  delete process.env.RUNTIME_SWEEP_BUGSINK_DSN;
  delete process.env.RUNTIME_SWEEP_BUGSINK_API_TOKEN;
  delete process.env.RUNTIME_SWEEP_LOKI_PUSH_URL;
  delete process.env.RUNTIME_SWEEP_LOKI_QUERY_URL;
  vi.unstubAllGlobals();
};
