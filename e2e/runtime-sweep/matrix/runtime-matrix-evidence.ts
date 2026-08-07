import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

import type {
  ConsoleRecord,
  PageErrorRecord,
  RequestFailureRecord,
  ResponseRecord,
} from "../evidence/evidence-types.ts";
import { inventoryDom } from "../replay/dom-inventory.ts";
import type { CoverageCell } from "../source/contracts.ts";
export type RuntimeEventRecords = Readonly<{
  readonly consoleMessages: readonly ConsoleRecord[];
  readonly pageErrors: readonly PageErrorRecord[];
  readonly requestFailures: readonly RequestFailureRecord[];
  readonly responses: readonly ResponseRecord[];
}>;
export type RuntimeEventCursor = Readonly<{
  readonly consoleMessages: number;
  readonly pageErrors: number;
  readonly requestFailures: number;
  readonly responses: number;
}>;
type RuntimeEventSlice = Readonly<{
  readonly records: RuntimeEventRecords;
  readonly cursor: RuntimeEventCursor;
}>;
export type RuntimeEvents = RuntimeEventRecords &
  Readonly<{
    readonly cursor: () => RuntimeEventCursor;
    readonly consumeSince: (cursor: RuntimeEventCursor) => RuntimeEventSlice;
    readonly snapshot: () => RuntimeEventRecords;
    readonly snapshotSince: (cursor: RuntimeEventCursor) => RuntimeEventRecords;
    readonly waitForIdle: () => Promise<void>;
    readonly detach: () => void;
  }>;

type RequestStart = Readonly<{
  readonly timestamp: string;
  readonly milliseconds: number;
}>;

const timingFor = (
  requestStarts: WeakMap<Request, RequestStart>,
  request: Request,
): Readonly<{ startedAt: string; endedAt: string; durationMs: number }> => {
  const endedMilliseconds = Date.now();
  const start = requestStarts.get(request) ?? {
    timestamp: new Date(endedMilliseconds).toISOString(),
    milliseconds: endedMilliseconds,
  };
  return {
    startedAt: start.timestamp,
    endedAt: new Date(endedMilliseconds).toISOString(),
    durationMs: Math.max(0, endedMilliseconds - start.milliseconds),
  };
};

const normalizedRequestUrl = (value: string): string => {
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:"
    ? `${url.pathname}${url.search}`
    : url.protocol;
};

const APP_REQUEST_IDLE_MS = 50;
const APP_REQUEST_TIMEOUT_MS = 5000;
const POLL_MS = 20;
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const isApplicationRequest = (request: Request): boolean =>
  ["fetch", "xhr"].includes(request.resourceType()) &&
  request.url().includes("/trpc/");

const eventHandlersFor = (
  records: Readonly<{
    consoleMessages: ConsoleRecord[];
    pageErrors: PageErrorRecord[];
    requestFailures: RequestFailureRecord[];
    responses: ResponseRecord[];
  }>,
) => {
  const requestStarts = new WeakMap<Request, RequestStart>();
  const pendingRequests = new Set<Request>();
  const onRequest = (request: Request): void => {
    const milliseconds = Date.now();
    requestStarts.set(request, {
      timestamp: new Date(milliseconds).toISOString(),
      milliseconds,
    });
    if (isApplicationRequest(request)) pendingRequests.add(request);
  };
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    records.consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
  };
  const onPageError = (error: Error): void => {
    records.pageErrors.push({ message: error.message });
  };
  const onRequestFailed = (request: Request): void => {
    pendingRequests.delete(request);
    records.requestFailures.push({
      url: normalizedRequestUrl(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText ?? null,
      ...timingFor(requestStarts, request),
    });
  };
  const onRequestFinished = (request: Request): void => {
    pendingRequests.delete(request);
  };
  const onResponse = (response: Response): void => {
    const request = response.request();
    records.responses.push({
      url: normalizedRequestUrl(response.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      status: response.status(),
      ok: response.ok(),
      correlationId: response.headers()["x-request-id"] ?? null,
      ...timingFor(requestStarts, request),
    });
  };
  return {
    onRequest,
    onConsole,
    onPageError,
    onRequestFailed,
    onRequestFinished,
    onResponse,
    pendingRequests,
  } as const;
};

type EventHandlers = ReturnType<typeof eventHandlersFor>;
type MutableRuntimeEventRecords = Readonly<{
  consoleMessages: ConsoleRecord[];
  pageErrors: PageErrorRecord[];
  requestFailures: RequestFailureRecord[];
  responses: ResponseRecord[];
}>;

const attachEventHandlers = (page: Page, handlers: EventHandlers): void => {
  page.on("request", handlers.onRequest);
  page.on("console", handlers.onConsole);
  page.on("pageerror", handlers.onPageError);
  page.on("requestfailed", handlers.onRequestFailed);
  page.on("requestfinished", handlers.onRequestFinished);
  page.on("response", handlers.onResponse);
};

const detachEventHandlers = (page: Page, handlers: EventHandlers): void => {
  page.off("request", handlers.onRequest);
  page.off("console", handlers.onConsole);
  page.off("pageerror", handlers.onPageError);
  page.off("requestfailed", handlers.onRequestFailed);
  page.off("requestfinished", handlers.onRequestFinished);
  page.off("response", handlers.onResponse);
};

const eventCursorFor = (
  records: MutableRuntimeEventRecords,
): RuntimeEventCursor => ({
  consoleMessages: records.consoleMessages.length,
  pageErrors: records.pageErrors.length,
  requestFailures: records.requestFailures.length,
  responses: records.responses.length,
});

const eventRecordsBetween = (
  records: MutableRuntimeEventRecords,
  start: RuntimeEventCursor,
  end: RuntimeEventCursor = eventCursorFor(records),
): RuntimeEventRecords => ({
  consoleMessages: records.consoleMessages.slice(
    start.consoleMessages,
    end.consoleMessages,
  ),
  pageErrors: records.pageErrors.slice(start.pageErrors, end.pageErrors),
  requestFailures: records.requestFailures.slice(
    start.requestFailures,
    end.requestFailures,
  ),
  responses: records.responses.slice(start.responses, end.responses),
});

const waitUntilIdle = async (
  pendingRequests: ReadonlySet<Request>,
  deadline: number,
): Promise<void> => {
  const hasPendingRequests = (): boolean => pendingRequests.size > 0;
  if (!hasPendingRequests()) {
    await sleep(APP_REQUEST_IDLE_MS);
    if (!hasPendingRequests()) return;
  }
  if (Date.now() >= deadline)
    throw new Error(
      `Runtime event ledger did not settle; ${String(pendingRequests.size)} application request(s) remain in flight`,
    );
  await sleep(POLL_MS);
  await waitUntilIdle(pendingRequests, deadline);
};

export const eventsFor = (
  page: Page,
  initial: RuntimeEventRecords = {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    responses: [],
  },
): RuntimeEvents => {
  const records: MutableRuntimeEventRecords = {
    consoleMessages: [...initial.consoleMessages],
    pageErrors: [...initial.pageErrors],
    requestFailures: [...initial.requestFailures],
    responses: [...initial.responses],
  };
  const handlers = eventHandlersFor(records);
  attachEventHandlers(page, handlers);
  const consumeSince = (start: RuntimeEventCursor): RuntimeEventSlice => {
    const cursor = eventCursorFor(records);
    return { records: eventRecordsBetween(records, start, cursor), cursor };
  };
  return {
    ...records,
    cursor: () => eventCursorFor(records),
    consumeSince,
    snapshot: () => ({
      consoleMessages: [...records.consoleMessages],
      pageErrors: [...records.pageErrors],
      requestFailures: [...records.requestFailures],
      responses: [...records.responses],
    }),
    snapshotSince: (start) => eventRecordsBetween(records, start),
    waitForIdle: () =>
      waitUntilIdle(
        handlers.pendingRequests,
        Date.now() + APP_REQUEST_TIMEOUT_MS,
      ),
    detach: () => detachEventHandlers(page, handlers),
  };
};

export const controlEvidence = (
  inventory: Awaited<ReturnType<typeof inventoryDom>>,
  cellId: string,
): CoverageCell["controls"] =>
  inventory.controls.map((control) => ({
    controlKey: control.controlKey,
    cellId,
    ariaRole: control.role,
    accessibleName: control.accessibleName,
    enabled: control.enabled,
    order: control.order,
    actionResult: {
      kind: "not-exercised",
      policy: "unavailable",
      reason: control.enabled
        ? "Navigation-only matrix scaffold; live-control lane must execute each DOM control"
        : "Control is disabled",
    },
  }));

export const writeCell = async (
  archiveRoot: string,
  cell: CoverageCell,
): Promise<void> => {
  const directory = path.join(archiveRoot, "cells", cell.profile, cell.role);
  const root = path.resolve(archiveRoot);
  const filePath = path.resolve(directory, `${cell.cellId}.json`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`))
    throw new Error(`Runtime matrix cell escaped archive: ${filePath}`);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cell, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
};
