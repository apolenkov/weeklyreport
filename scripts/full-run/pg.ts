import { TOP_N } from "./constants.ts";

export interface Statement {
  query: string;
  calls: number;
  total_exec_time: number;
  mean_exec_time: number;
  max_exec_time: number;
  rows: number;
}
export interface TableStat {
  relname: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number | null;
  n_live_tup: number;
}
interface IndexStat {
  relname: string;
  indexrelname: string;
  idx_scan: number;
}
export interface Snapshot {
  statements: Statement[];
  tables: TableStat[];
  indexes: IndexStat[];
}

function addStatement(into: Map<string, Statement>, s: Statement): void {
  const have = into.get(s.query);
  if (!have) {
    into.set(s.query, { ...s });
    return;
  }
  have.calls += s.calls;
  have.total_exec_time += s.total_exec_time;
  have.rows += s.rows;
  have.max_exec_time = Math.max(have.max_exec_time, s.max_exec_time);
  have.mean_exec_time = have.total_exec_time / have.calls;
}

function addTable(into: Map<string, TableStat>, t: TableStat): void {
  const have = into.get(t.relname);
  if (!have) {
    into.set(t.relname, { ...t, idx_scan: t.idx_scan ?? 0 });
    return;
  }
  have.seq_scan += t.seq_scan;
  have.seq_tup_read += t.seq_tup_read;
  have.idx_scan = (have.idx_scan ?? 0) + (t.idx_scan ?? 0);
  have.n_live_tup = Math.max(have.n_live_tup, t.n_live_tup);
}

function addIndex(into: Map<string, IndexStat>, i: IndexStat): void {
  const key = `${i.relname}.${i.indexrelname}`;
  const have = into.get(key);
  if (have) have.idx_scan += i.idx_scan;
  else into.set(key, { ...i });
}

/** Sums disjoint snapshot segments (stats are reset after every database wipe); statements merge by text. */
export function mergeSnapshots(snaps: readonly Snapshot[]): Snapshot {
  const statements = new Map<string, Statement>();
  const tables = new Map<string, TableStat>();
  const indexes = new Map<string, IndexStat>();
  for (const snap of snaps) {
    for (const s of snap.statements) addStatement(statements, s);
    for (const t of snap.tables) addTable(tables, t);
    for (const i of snap.indexes) addIndex(indexes, i);
  }
  return {
    statements: [...statements.values()],
    tables: [...tables.values()],
    indexes: [...indexes.values()],
  };
}

export const OWN_QUERIES =
  /pg_stat_|pg_catalog|pg_class|EXPLAIN|ALTER SYSTEM|idx_trial|json_build|^(BEGIN|COMMIT|ROLLBACK|SET |SHOW |DEALLOCATE)/i;

/** Top `n` statements by a metric; the kit's own and transaction-control statements are excluded. */
export function top(
  statements: readonly Statement[],
  metric: "total_exec_time" | "mean_exec_time",
  n = TOP_N,
): Statement[] {
  return statements
    .filter((s) => !OWN_QUERIES.test(s.query))
    .toSorted((a, b) => b[metric] - a[metric])
    .slice(0, n);
}
