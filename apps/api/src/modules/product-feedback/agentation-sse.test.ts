import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  type AgentationSseEvent,
  type AgentationSseSource,
  runAgentationSsePoll,
  startAgentationSse,
} from "./agentation-sse";

function harness(
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const req = new EventEmitter() as EventEmitter & {
    query: Record<string, string>;
    header: (name: string) => string | undefined;
  };
  req.query = query;
  req.header = (name) => headers[name.toLowerCase()];
  const responseEvents = new EventEmitter();
  const res = Object.assign(responseEvents, {
    writableEnded: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    write: vi.fn(),
    flushHeaders: vi.fn(),
  });
  return { req: req as never, res: res as never, response: res };
}

function source(
  events: readonly AgentationSseEvent[] = [],
  pending: readonly unknown[] = [],
): AgentationSseSource {
  const latest = events.reduce(
    (value, event) =>
      BigInt(event.sequence) > value ? BigInt(event.sequence) : value,
    0n,
  );
  return {
    loadEvents: vi.fn(() => Promise.resolve(events)),
    loadPending: vi.fn(() => Promise.resolve(pending)),
    loadLatestSequence: vi.fn(() => Promise.resolve(latest)),
  };
}

describe("Agentation SSE transport", () => {
  it("replays after Last-Event-ID in sequence order", async () => {
    const events = [1, 3, 2].map((n) => ({
      type: "annotation.updated",
      timestamp: "2026-01-01T00:00:00.000Z",
      sequence: n,
      payload: { n },
    }));
    const s = source(events);
    const { req, res, response } = harness({}, { "last-event-id": "1" });
    const timers: (() => void)[] = [];
    await startAgentationSse({
      req,
      res,
      source: s,
      agent: false,
      allowGlobal: true,
      setIntervalFn: (cb) => {
        timers.push(cb);
        return timers.length;
      },
      clearIntervalFn: vi.fn(),
    });
    expect(
      response.write.mock.calls
        .map(([value]) => String(value))
        .filter((value) => value.startsWith("id:"))
        .map((value) => value.slice(4, 5)),
    ).toEqual(["2", "3"]);
    (req as unknown as EventEmitter).emit("close");
  });

  it("starts a fresh stream at the current scoped sequence", async () => {
    const events = [
      {
        type: "annotation.created",
        timestamp: "2026-01-01T00:00:00.000Z",
        sequence: 7,
        payload: { id: "old" },
      },
    ];
    const s = source(events);
    const { req, res, response } = harness();

    await startAgentationSse({
      req,
      res,
      source: s,
      scopedSessionId: "session-1",
      agent: false,
      allowGlobal: false,
      setIntervalFn: () => 1,
      clearIntervalFn: vi.fn(),
    });

    expect(s.loadLatestSequence).toHaveBeenCalledWith("session-1");
    expect(s.loadEvents).toHaveBeenCalledWith(7n, "session-1");
    expect(response.write).not.toHaveBeenCalled();
    (req as unknown as EventEmitter).emit("close");
  });

  it("sends agent initial pending sequence zero and sync.complete", async () => {
    const { req, res, response } = harness();
    const s = source([], [{ id: "a" }, { id: "b" }]);
    await startAgentationSse({
      req,
      res,
      source: s,
      agent: true,
      allowGlobal: true,
      maxBatchSize: 1,
      setIntervalFn: () => 1,
      clearIntervalFn: vi.fn(),
    });
    const output = response.write.mock.calls
      .map(([value]) => String(value))
      .join("");
    expect(output).toContain("event: annotation.created");
    expect(output).toContain('"sequence":0');
    expect(output).toContain("event: sync.complete");
    expect(output).toContain('"count":1');
    expect(output).not.toContain("event: ready");
    (req as unknown as EventEmitter).emit("close");
  });

  it("does not initial-sync a session-scoped agent stream", async () => {
    const { req, res, response } = harness();
    const s = source([], [{ id: "a" }]);

    await startAgentationSse({
      req,
      res,
      source: s,
      scopedSessionId: "session-1",
      agent: true,
      allowGlobal: true,
      setIntervalFn: () => 1,
      clearIntervalFn: vi.fn(),
    });

    expect(s.loadPending).not.toHaveBeenCalled();
    expect(response.write).not.toHaveBeenCalled();
    (req as unknown as EventEmitter).emit("close");
  });

  it("denies global stream and mismatched domain", async () => {
    const s = source();
    const denied = harness();
    await startAgentationSse({
      req: denied.req,
      res: denied.res,
      source: s,
      agent: false,
      allowGlobal: false,
    });
    expect(denied.response.status).toHaveBeenCalledWith(403);
    const domain = harness({ domain: "evil.example" });
    await startAgentationSse({
      req: domain.req,
      res: domain.res,
      source: s,
      agent: false,
      allowGlobal: true,
      expectedFrontendOrigin: "https://app.example.com",
    });
    expect(domain.response.status).toHaveBeenCalledWith(403);
  });

  it("cleans polling and heartbeat timers on close", async () => {
    const clear = vi.fn();
    const { req, res } = harness();
    await startAgentationSse({
      req,
      res,
      source: source(),
      agent: false,
      allowGlobal: true,
      setIntervalFn: () => 1,
      clearIntervalFn: clear,
    });
    (req as unknown as EventEmitter).emit("close");
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it("exports one bounded polling cycle", async () => {
    const events = [1, 2, 3].map((sequence) => ({
      type: "x",
      timestamp: "now",
      sequence,
      payload: {},
    }));
    const h = harness();
    const next = await runAgentationSsePoll(
      {
        req: h.req,
        res: h.res,
        source: source(events),
        agent: false,
        allowGlobal: true,
        maxBatchSize: 2,
      },
      0n,
    );
    expect(next).toBe(2n);
    expect(h.response.write).toHaveBeenCalledTimes(2);
  });
});
