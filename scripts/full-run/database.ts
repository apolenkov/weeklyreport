import { MIN_MEAN_CALLS, NPLUS1_LIST } from "./constants.ts";
import { type Interval, pgStatements, repeats } from "./logs.ts";
import { mergeSnapshots, type Snapshot, type Statement, top } from "./pg.ts";
import type { RunDir } from "./run-dir.ts";

export interface ExplainItem {
  query: string;
  plan: string;
  usesSeqScan: boolean;
  executionMs: number | null;
  candidate: {
    index: string;
    after: string;
    afterNoSeqScan: string;
    costBefore: number;
    costAfter: number;
  } | null;
  note: string;
}
export interface Grouped {
  sql: string;
  max: number;
  windows: number;
  procedures: Set<string>;
}

/** Statistics segments of the run; segment 00 is the state before the run (the first reset). */
export function loadStatistics(run: RunDir) {
  const snaps = run
    .files("segments", /^stats-(?!00)\d+\.json$/)
    .map((f) => JSON.parse(run.read(`segments/${f}`)) as Snapshot);
  const merged = mergeSnapshots(snaps);
  const tables = merged.tables
    .map((t) => ({ ...t, idx_scan: t.idx_scan ?? 0 }))
    .toSorted((a, b) => b.seq_scan - a.seq_scan);
  const frequent = (s: Statement): boolean => s.calls >= MIN_MEAN_CALLS;
  return {
    statements: merged.statements,
    byTotal: top(merged.statements, "total_exec_time"),
    byMean: top(merged.statements.filter(frequent), "mean_exec_time"),
    tables,
  };
}

/** N+1 candidates: only SELECTs that ran inside a tRPC window (seed and fixture inserts are not screen behaviour). */
export function nPlusOne(run: RunDir, windows: readonly Interval[]): Grouped[] {
  const log = run.exists("logs/postgres-wr-run.log")
    ? run.read("logs/postgres-wr-run.log")
    : "";
  const grouped = new Map<string, Grouped>();
  for (const r of repeats(pgStatements(log), windows)) {
    if (!/^\s*select/i.test(r.sql) || r.procedures.length === 0) continue;
    const have = grouped.get(r.sql) ?? {
      sql: r.sql,
      max: 0,
      windows: 0,
      procedures: new Set<string>(),
    };
    have.max = Math.max(have.max, r.count);
    have.windows += 1;
    for (const p of r.procedures) have.procedures.add(p);
    grouped.set(r.sql, have);
  }
  return [...grouped.values()]
    .toSorted((a, b) => b.windows - a.windows)
    .slice(0, NPLUS1_LIST);
}

const richer = (have: ExplainItem | undefined, e: ExplainItem): boolean =>
  !have ||
  (have.plan === "" && e.plan !== "") ||
  (!have.candidate && e.candidate !== null);

/** One explain file per segment; keeps the richest result per statement text. */
export function loadExplain(run: RunDir): ExplainItem[] {
  const byQuery = new Map<string, ExplainItem>();
  for (const f of run.files("segments", /^explain-(?!00)\d+\.json$/))
    for (const e of JSON.parse(run.read(`segments/${f}`)) as ExplainItem[])
      if (richer(byQuery.get(e.query), e)) byQuery.set(e.query, e);
  return [...byQuery.values()]
    .filter((e) => e.plan !== "")
    .toSorted(
      (a, b) =>
        Number(b.candidate !== null) - Number(a.candidate !== null) ||
        (b.executionMs ?? 0) - (a.executionMs ?? 0),
    );
}
