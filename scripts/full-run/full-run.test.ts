import { describe, expect, it } from "vitest";

import {
  intervals,
  mappedRoutes,
  metricsCalls,
  pgStatements,
  procedureCalls,
  repeats,
} from "./logs.ts";
import { mergeSnapshots, top } from "./pg.ts";

const start = (procedure: string, role: string): string =>
  JSON.stringify({
    phase: "trpc.request",
    stage: "start",
    procedure,
    role,
    message: "trpc request start",
  });

describe("api log parsing", () => {
  it("counts procedure calls per role from top-level fields", () => {
    const used = procedureCalls([
      start("a.b", "lead"),
      start("a.b", "head"),
      start("c.d", "lead"),
      "not json",
    ]);
    expect(used.get("a.b")).toEqual({
      calls: 2,
      roles: new Set(["lead", "head"]),
    });
    expect(used.get("c.d")?.calls).toBe(1);
  });

  it("reads fields from a JSON tail of the message", () => {
    const line = JSON.stringify({
      message:
        'trpc request start {"phase":"trpc.request","stage":"start","procedure":"x.y","role":"admin"}',
    });
    expect(procedureCalls([line]).get("x.y")?.roles).toEqual(
      new Set(["admin"]),
    );
  });

  it("lists Nest routes and prometheus http counters", () => {
    expect(
      mappedRoutes(['{"message":"Mapped {/health/live, GET} route"}']),
    ).toEqual(["GET /health/live"]);
    const text =
      'http_request_duration_seconds_count{method="GET",route="/a",status_code="200"} 2\nhttp_request_duration_seconds_count{method="GET",route="/a",status_code="500"} 1';
    expect(metricsCalls(text).get("GET /a")).toBe(3);
  });

  it("derives execution windows from end lines", () => {
    const end = JSON.stringify({
      phase: "trpc.request",
      stage: "end",
      procedure: "p",
      duration: 100,
      timestamp: "2026-10-05T00:00:01.000Z",
    });
    expect(intervals([end])).toEqual([
      {
        procedure: "p",
        start: Date.parse("2026-10-05T00:00:00.900Z"),
        end: Date.parse("2026-10-05T00:00:01.000Z"),
      },
    ]);
  });
});

describe("postgres statement log", () => {
  const line = (ms: string, pid: number, sql: string): string =>
    `2026-10-05 00:00:00.${ms} UTC [${pid}] LOG:  execute <unnamed>: ${sql}`;

  it("flags the same statement repeated on one backend inside the window as N+1", () => {
    const text = [100, 110, 120, 130, 140]
      .map((ms) => line(String(ms), 7, 'SELECT * FROM "A" WHERE id = $1'))
      .join("\n");
    const found = repeats(pgStatements(text), []);
    expect(found).toHaveLength(1);
    expect(found[0]?.count).toBe(5);
  });

  it("ignores statements on different backends and slow repeats", () => {
    const text = [
      line("100", 1, "SELECT 2"),
      line("110", 2, "SELECT 2"),
      line("900", 1, "SELECT 2"),
    ].join("\n");
    expect(repeats(pgStatements(text), [])).toEqual([]);
  });
});

describe("statistics merge", () => {
  const stmt = (calls: number, total: number) => ({
    query: "q",
    calls,
    total_exec_time: total,
    mean_exec_time: total / calls,
    max_exec_time: total,
    rows: calls,
  });
  it("sums disjoint segments and recomputes the mean", () => {
    const empty = { tables: [], indexes: [] };
    const merged = mergeSnapshots([
      { ...empty, statements: [stmt(2, 4)] },
      { ...empty, statements: [stmt(2, 8)] },
    ]);
    expect(merged.statements[0]).toMatchObject({
      calls: 4,
      total_exec_time: 12,
      mean_exec_time: 3,
    });
  });

  it("drops the stats extension's own queries from the top list", () => {
    const own = { ...stmt(1, 99), query: "SELECT * FROM pg_stat_statements" };
    expect(top([own, stmt(1, 1)], "total_exec_time")).toHaveLength(1);
  });
});
