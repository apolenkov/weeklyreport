import { NPLUS1_MIN_REPEATS, NPLUS1_WINDOW_MS } from "./constants.ts";

export type Entry = Readonly<Record<string, unknown>>;

export interface ProcedureUse {
  calls: number;
  /** Calls that finished with `status: success`: a rejected input or a failed handler is not an exercised procedure. */
  ok: number;
  roles: Set<string>;
}
export interface Interval {
  procedure: string;
  start: number;
  end: number;
}
export interface PgStatement {
  time: number;
  pid: string;
  sql: string;
}
export interface Repeat {
  sql: string;
  count: number;
  at: number;
  procedures: string[];
}

/** Text of a log field: strings as they are, anything else as JSON, missing as empty. */
export function text(value: unknown): string {
  if (typeof value === "string") return value;
  return value === undefined ? "" : JSON.stringify(value);
}

/** Parses one api log line (JSON). Structured fields may be top level or a JSON tail of `message`. */
export function parseApiLine(line: string): Entry | null {
  let entry: Entry;
  try {
    entry = JSON.parse(line) as Entry;
  } catch {
    return null;
  }
  const message = text(entry.message);
  const tail = message.indexOf(" {");
  if (tail === -1) return entry;
  try {
    return { ...(JSON.parse(message.slice(tail + 1)) as Entry), ...entry };
  } catch {
    return entry;
  }
}

function trpcEntries(lines: readonly string[], stage: string): Entry[] {
  const found: Entry[] = [];
  for (const line of lines) {
    const entry = parseApiLine(line);
    if (entry?.phase === "trpc.request" && entry.stage === stage)
      found.push(entry);
  }
  return found;
}

function entryFor(
  used: Map<string, ProcedureUse>,
  procedure: string,
): ProcedureUse {
  const use = used.get(procedure) ?? { calls: 0, ok: 0, roles: new Set() };
  used.set(procedure, use);
  return use;
}

/** tRPC procedures called (`trpc request start`) and finished successfully (`trpc request end`). */
export function procedureCalls(
  lines: readonly string[],
): Map<string, ProcedureUse> {
  const used = new Map<string, ProcedureUse>();
  for (const e of trpcEntries(lines, "start")) {
    const use = entryFor(used, text(e.procedure));
    use.calls += 1;
    use.roles.add(typeof e.role === "string" ? e.role : "anonymous");
  }
  for (const e of trpcEntries(lines, "end"))
    if (e.status === "success") entryFor(used, text(e.procedure)).ok += 1;
  return used;
}

/** HTTP (non-tRPC) requests seen by the access log: "METHOD path" -> count. */
export function httpCalls(lines: readonly string[]): Map<string, number> {
  const seen = new Map<string, number>();
  for (const line of lines) {
    const e = parseApiLine(line);
    if (e?.phase !== "http.request") continue;
    const key = `${text(e.method)} ${text(e.path)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return seen;
}

/** Nest routes from the startup "Mapped {path, METHOD} route" lines. */
export function mappedRoutes(lines: readonly string[]): string[] {
  const routes = new Set<string>();
  for (const line of lines) {
    const m = /Mapped \{([^,}]+), (\w+)\} route/.exec(line);
    if (m) routes.add(`${m[2] ?? ""} ${m[1] ?? ""}`);
  }
  return [...routes].toSorted((a, b) => a.localeCompare(b));
}

/** Procedure execution windows from `trpc request end` (timestamp minus duration .. timestamp). */
export function intervals(lines: readonly string[]): Interval[] {
  const out: Interval[] = [];
  for (const e of trpcEntries(lines, "end")) {
    const end = Date.parse(text(e.timestamp));
    const duration = Number(e.duration);
    if (Number.isFinite(end) && Number.isFinite(duration))
      out.push({
        procedure: text(e.procedure),
        start: end - duration,
        end,
      });
  }
  return out;
}

const PG_HEAD =
  /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+) (\w+) \[(\d+)\] LOG:\s+(?:execute [^:]*|statement): (.*)$/;

/** Statements of the Postgres log (log_statement=all, prefix "%m [%p] "). */
export function pgStatements(logText: string): PgStatement[] {
  const out: PgStatement[] = [];
  for (const line of logText.split("\n")) {
    const m = PG_HEAD.exec(line);
    if (!m) continue;
    const zone = m[2] === "UTC" ? "Z" : "";
    out.push({
      time: Date.parse(`${(m[1] ?? "").replace(" ", "T")}${zone}`),
      pid: m[3] ?? "",
      sql: m[4] ?? "",
    });
  }
  return out;
}

const NOISE = /^(BEGIN|COMMIT|ROLLBACK|SET |SHOW |SELECT 1$|DEALLOCATE)/i;

function timesByStatement(
  statements: readonly PgStatement[],
): Map<string, number[]> {
  const byKey = new Map<string, number[]>();
  for (const s of statements) {
    if (NOISE.test(s.sql)) continue;
    const key = `${s.pid}\u0000${s.sql}`;
    const times = byKey.get(key);
    if (times) times.push(s.time);
    else byKey.set(key, [s.time]);
  }
  return byKey;
}

/** Start time and size of each burst: `min` or more times inside `windowMs`. */
function bursts(
  times: readonly number[],
  windowMs: number,
  min: number,
): { at: number; count: number }[] {
  const found: { at: number; count: number }[] = [];
  let lo = 0;
  for (let hi = 0; hi < times.length; hi += 1) {
    while ((times[hi] ?? 0) - (times[lo] ?? 0) > windowMs) lo += 1;
    const last = (times[hi + 1] ?? Infinity) - (times[lo] ?? 0) > windowMs;
    if (hi - lo + 1 >= min && last) {
      found.push({ at: times[lo] ?? 0, count: hi - lo + 1 });
      lo = hi + 1;
    }
  }
  return found;
}

/** N+1 candidates: one backend runs the same statement at least `min` times within `windowMs`. */
export function repeats(
  statements: readonly PgStatement[],
  windows: readonly Interval[],
  windowMs = NPLUS1_WINDOW_MS,
  min = NPLUS1_MIN_REPEATS,
): Repeat[] {
  const found: Repeat[] = [];
  for (const [key, times] of timesByStatement(statements)) {
    const sql = key.split("\u0000")[1] ?? "";
    for (const burst of bursts(times, windowMs, min)) {
      const procedures = windows
        .filter((w) => w.start <= burst.at && burst.at <= w.end)
        .map((w) => w.procedure);
      found.push({
        sql,
        count: burst.count,
        at: burst.at,
        procedures: [...new Set(procedures)],
      });
    }
  }
  return found.toSorted((a, b) => b.count - a.count);
}

const METRIC =
  /^http_request_duration_seconds_count\{method="(\w+)",route="([^"]*)",status_code="\d+"\} (\d+)/;

/** Prometheus `http_request_duration_seconds_count` lines: "METHOD route" -> count (tRPC routes included). */
export function metricsCalls(metrics: string): Map<string, number> {
  const seen = new Map<string, number>();
  for (const line of metrics.split("\n")) {
    const m = METRIC.exec(line);
    if (!m) continue;
    const key = `${m[1] ?? ""} ${m[2] ?? ""}`;
    seen.set(key, (seen.get(key) ?? 0) + Number(m[3]));
  }
  return seen;
}
