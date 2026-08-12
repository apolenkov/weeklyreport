import { randomUUID } from "node:crypto";

import type { Request } from "@playwright/test";

export type RuntimeRequestStart = Readonly<{
  readonly requestId: string;
  readonly timestamp: string;
  readonly milliseconds: number;
}>;

const runtimeRequestStart = (
  requestStarts: WeakMap<Request, RuntimeRequestStart>,
  request: Request,
): RuntimeRequestStart => {
  const existing = requestStarts.get(request);
  if (existing !== undefined) return existing;
  const milliseconds = Date.now();
  const created = {
    requestId: randomUUID(),
    timestamp: new Date(milliseconds).toISOString(),
    milliseconds,
  };
  requestStarts.set(request, created);
  return created;
};

export const registerRuntimeRequest = (
  requestStarts: WeakMap<Request, RuntimeRequestStart>,
  request: Request,
): void => {
  runtimeRequestStart(requestStarts, request);
};

export const runtimeRequestTiming = (
  requestStarts: WeakMap<Request, RuntimeRequestStart>,
  request: Request,
): Readonly<{
  requestId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}> => {
  const endedMilliseconds = Date.now();
  const start = runtimeRequestStart(requestStarts, request);
  return {
    requestId: start.requestId,
    startedAt: start.timestamp,
    endedAt: new Date(endedMilliseconds).toISOString(),
    durationMs: Math.max(0, endedMilliseconds - start.milliseconds),
  };
};

export const normalizedRuntimeRequestUrl = (value: string): string => {
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:"
    ? url.href
    : url.protocol;
};
