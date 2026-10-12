import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  type AgentationSseEvent,
  type AgentationSseSource,
  getAgentationSseConnectionCounts,
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
    destroyed: false,
    writableEnded: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    write: vi.fn(),
    flushHeaders: vi.fn(),
    end: vi.fn(),
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
    loadDeletionEvents: vi.fn(() => Promise.resolve([])),
  };
}

describe("Agentation SSE transport", () => {
  it("keeps an idle stream alive before the web proxy's 30-second timeout", async () => {
    vi.useFakeTimers();
    const { req, res, response } = harness();
    try {
      await startAgentationSse({
        req,
        res,
        source: source(),
        agent: false,
        allowGlobal: true,
      });
      await vi.advanceTimersByTimeAsync(29_000);
      expect(response.write).toHaveBeenCalledWith(": ping\n\n");
    } finally {
      (req as unknown as EventEmitter).emit("close");
      vi.useRealTimers();
    }
  });

  it("does not start timers after disconnecting during the initial read", async () => {
    const { req, res, response } = harness();
    const s = source();
    s.loadEvents = () => {
      response.destroyed = true;
      response.emit("close");
      return Promise.resolve([]);
    };
    const setIntervalFn = vi.fn();
    await startAgentationSse({
      req,
      res,
      source: s,
      agent: false,
      allowGlobal: true,
      setIntervalFn,
    });
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it("replays all deletion pages before polling beyond the captured snapshot", async () => {
    const tombstones = [1, 3, 5].map((value) => ({
      type: "annotation.updated",
      sequence: BigInt(value),
      timestamp: "2026-09-04T00:00:00.000Z",
      payload: { id: `deleted-${value}`, deleted: true, status: "dismissed" },
    }));
    const s = source(tombstones);
    s.loadDeletionEvents = vi.fn<AgentationSseSource["loadDeletionEvents"]>(
      (_id, after, through, limit) =>
        Promise.resolve(
          tombstones
            .filter(
              (event) => event.sequence > after && event.sequence <= through,
            )
            .slice(0, limit),
        ),
    );
    const { req, res, response } = harness();
    await startAgentationSse({
      req,
      res,
      source: s,
      scopedSessionId: "s-1",
      agent: false,
      allowGlobal: false,
      maxBatchSize: 2,
      setIntervalFn: vi.fn(),
      clearIntervalFn: vi.fn(),
    });
    expect(s.loadDeletionEvents).toHaveBeenNthCalledWith(1, "s-1", 0n, 5n, 2);
    expect(s.loadDeletionEvents).toHaveBeenNthCalledWith(2, "s-1", 3n, 5n, 2);
    expect(
      response.write.mock.calls.filter(([value]) =>
        String(value).startsWith("id:"),
      ),
    ).toHaveLength(3);
    expect(s.loadEvents).toHaveBeenCalledWith(5n, "s-1");
    (res as unknown as EventEmitter).emit("close");
  });

  it("prevents proxy compression and immediately opens the response body", async () => {
    const { req, res, response } = harness();
    await startAgentationSse({
      req,
      res,
      source: source(),
      scopedSessionId: "s-1",
      agent: false,
      allowGlobal: false,
      setIntervalFn: vi.fn(),
      clearIntervalFn: vi.fn(),
    });
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "cache-control": "no-cache, no-transform",
      }),
    );
    expect(response.write).toHaveBeenCalledWith(": connected\n\n");
    (res as unknown as EventEmitter).emit("close");
  });

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
    expect(s.loadDeletionEvents).not.toHaveBeenCalled();
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
    expect(response.write.mock.calls).toEqual([[": connected\n\n"]]);
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
    expect(response.write.mock.calls).toEqual([[": connected\n\n"]]);
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

  it.each([
    "loadLatestSequence",
    "loadDeletionEvents",
    "loadPending",
    "loadEvents",
  ] as const)(
    "ends a post-flush %s failure without leaking listeners",
    async (phase) => {
      const { req, res, response } = harness();
      const s = source();
      s.loadLatestSequence = () => Promise.resolve(1n);
      s[phase] = (): Promise<never> =>
        Promise.reject(new Error("private source failure"));
      const timers = vi.fn();
      const before = getAgentationSseConnectionCounts();

      await expect(
        startAgentationSse({
          req,
          res,
          source: s,
          agent: phase === "loadPending",
          allowGlobal: true,
          ...(phase === "loadDeletionEvents" ? { scopedSessionId: "s-1" } : {}),
          setIntervalFn: timers,
        }),
      ).resolves.toBeUndefined();

      expect(response.flushHeaders).toHaveBeenCalledOnce();
      expect(response.end).toHaveBeenCalledOnce();
      expect(response.json).not.toHaveBeenCalled();
      expect(timers).not.toHaveBeenCalled();
      expect(getAgentationSseConnectionCounts()).toEqual(before);
      expect(response.write.mock.calls).toEqual([[": connected\n\n"]]);
    },
  );

  it("does not deliver or advance a deferred poll after disconnect", async () => {
    const { req, res, response } = harness();
    const pending = Promise.withResolvers<readonly AgentationSseEvent[]>();
    const s = source();
    s.loadEvents = () => pending.promise;
    const poll = runAgentationSsePoll(
      { req, res, source: s, agent: false, allowGlobal: true },
      4n,
    );
    response.destroyed = true;
    pending.resolve([
      {
        type: "annotation.updated",
        sequence: 5n,
        timestamp: "now",
        payload: {},
      },
    ]);

    expect(await poll).toBe(4n);
    expect(response.write).not.toHaveBeenCalled();
  });

  it.each(["loadPending", "loadDeletionEvents"] as const)(
    "does not deliver a deferred initial %s after disconnect",
    async (phase) => {
      const { req, res, response } = harness();
      const pending = Promise.withResolvers<readonly AgentationSseEvent[]>();
      const s = source();
      s.loadLatestSequence = () => Promise.resolve(1n);
      const entered = Promise.withResolvers<void>();
      s[phase] = () => {
        entered.resolve();
        return pending.promise;
      };
      const timers = vi.fn();
      const startup = startAgentationSse({
        req,
        res,
        source: s,
        agent: phase === "loadPending",
        allowGlobal: true,
        ...(phase === "loadDeletionEvents" ? { scopedSessionId: "s-1" } : {}),
        setIntervalFn: timers,
      });
      await entered.promise;
      response.destroyed = true;
      pending.resolve([
        {
          type: "annotation.updated",
          sequence: 1,
          timestamp: "now",
          payload: {},
        },
      ]);
      await startup;

      expect(response.write.mock.calls).toEqual([[": connected\n\n"]]);
      expect(timers).not.toHaveBeenCalled();
    },
  );

  it("does not poll or heartbeat a destroyed response and cleans listeners once", async () => {
    const { req, res, response } = harness();
    const s = source();
    const callbacks: (() => void)[] = [];
    const clear = vi.fn();
    const before = getAgentationSseConnectionCounts();
    await startAgentationSse({
      req,
      res,
      source: s,
      agent: true,
      allowGlobal: true,
      setIntervalFn: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      clearIntervalFn: clear,
    });
    const writes = response.write.mock.calls.length;
    response.destroyed = true;
    for (const callback of callbacks) callback();
    (req as unknown as EventEmitter).emit("close");
    response.emit("close");

    expect(response.write).toHaveBeenCalledTimes(writes);
    expect(s.loadEvents).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledTimes(2);
    expect(getAgentationSseConnectionCounts()).toEqual(before);
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
