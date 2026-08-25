import { EventEmitter } from "node:events";

import type { Page, Request, Response } from "@playwright/test";
import { describe, expect, it } from "vitest";

import {
  eventCounts,
  hasRuntimeFailures,
} from "../../evidence/runtime-event-summary.ts";
import { eventsFor } from "../runtime-matrix-evidence.ts";

describe("runtime matrix event evidence", () => {
  it("summarizes console, page, and request failures without dropping a channel", () => {
    const events = {
      consoleMessages: [{ type: "warning", text: "warning" }],
      pageErrors: [],
      requestFailures: [
        {
          requestId: "failed-request",
          url: "/trpc/report",
          method: "POST",
          resourceType: "fetch",
          failure: "aborted",
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T00:00:00.100Z",
          durationMs: 100,
        },
      ],
      responses: [
        {
          requestId: "error-response",
          url: "/trpc/report",
          method: "POST",
          resourceType: "fetch",
          status: 500,
          ok: false,
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T00:00:00.100Z",
          durationMs: 100,
          correlationId: "runtime-matrix-test",
        },
      ],
    } as const;

    expect(eventCounts(events)).toEqual({
      consoleMessages: 1,
      pageErrors: 0,
      requestFailures: 1,
      httpErrorResponses: 1,
    });
    expect(hasRuntimeFailures(events)).toBe(true);
  });

  it("keeps a clean event window clean", () => {
    const events = {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [],
      responses: [],
    } as const;

    expect(eventCounts(events)).toEqual({
      consoleMessages: 0,
      pageErrors: 0,
      requestFailures: 0,
      httpErrorResponses: 0,
    });
    expect(hasRuntimeFailures(events)).toBe(false);
  });

  it("consumes a transport failure at exactly one advancing phase boundary", () => {
    const emitter = new EventEmitter();
    const page = emitter as unknown as Page;
    const events = eventsFor(page);
    const beforePhase = events.cursor();
    const request = {
      resourceType: () => "fetch",
      url: () => "https://runtime.invalid/trpc/report.read",
      method: () => "POST",
      failure: () => ({ errorText: "net::ERR_ABORTED" }),
    } as unknown as Request;
    const response = {
      request: () => request,
      url: () => request.url(),
      status: () => 200,
      ok: () => true,
      headers: () => ({}),
    } as unknown as Response;

    emitter.emit("request", request);
    emitter.emit("response", response);
    emitter.emit("requestfailed", request);
    const actionPhase = events.consumeSince(beforePhase);
    const afterPhase = events.consumeSince(actionPhase.cursor);

    expect(actionPhase.records.requestFailures).toHaveLength(1);
    expect(actionPhase.records.requestFailures[0]?.url).toBe(
      "https://runtime.invalid/trpc/report.read",
    );
    expect(actionPhase.records.requestFailures[0]?.requestId).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    expect(actionPhase.records.responses[0]?.requestId).toBe(
      actionPhase.records.requestFailures[0]?.requestId,
    );
    expect(hasRuntimeFailures(actionPhase.records)).toBe(true);
    expect(afterPhase.records.requestFailures).toHaveLength(0);
    expect(afterPhase.cursor).toEqual(actionPhase.cursor);
    events.detach();
  });

  it("waits for a request spanning the phase boundary and captures its failure", async () => {
    const emitter = new EventEmitter();
    const page = emitter as unknown as Page;
    const events = eventsFor(page);
    const cursor = events.cursor();
    const request = {
      resourceType: () => "fetch",
      url: () => "https://runtime.invalid/trpc/report.read",
      method: () => "POST",
    } as unknown as Request;
    const response = {
      request: () => request,
      url: () => request.url(),
      status: () => 503,
      ok: () => false,
      headers: () => ({ "x-request-id": "spanning-request" }),
    } as unknown as Response;

    emitter.emit("request", request);
    const completion = new Promise<void>((resolve) => {
      setTimeout(() => {
        emitter.emit("response", response);
        emitter.emit("requestfinished", request);
        resolve();
      }, 20);
    });
    await events.waitForIdle();
    await completion;
    const consumed = events.consumeSince(cursor);

    expect(consumed.records.responses).toMatchObject([
      { status: 503, ok: false, correlationId: "spanning-request" },
    ]);
    expect(hasRuntimeFailures(consumed.records)).toBe(true);
    events.detach();
  });
});
