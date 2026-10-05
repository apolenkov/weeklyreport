// Runs inside the pre-reset hook, while the segment's data is still there: EXPLAIN (ANALYZE, BUFFERS) for the heaviest
// statements on the stand data and a rolled-back trial index for each sequential scan with a filter.
// Usage: explain.ts <output.json>
import { writeFileSync } from "node:fs";

import { EXPLAIN_LIMIT } from "./constants.ts";
import { postgresLog, psql } from "./kube.ts";
import {
  collapse,
  describe,
  filterColumns,
  indexLog,
  type Logged,
  nodes,
  type PlanNode,
  signature,
  withParameters,
} from "./plan.ts";

interface Candidate {
  index: string;
  after: string;
  afterNoSeqScan: string;
  costBefore: number;
  costAfter: number;
}
interface Item {
  query: string;
  plan: string;
  usesSeqScan: boolean;
  executionMs: number | null;
  candidate: Candidate | null;
  note: string;
}

interface Explained {
  plan: PlanNode;
  ms: number | null;
}

function explain(sql: string, prefix = ""): Explained {
  const out = psql(
    `BEGIN;\n${prefix}EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql};\nROLLBACK;`,
  );
  const json = out.slice(out.indexOf("["), out.lastIndexOf("]") + 1);
  const doc = JSON.parse(json) as [
    { Plan: PlanNode; "Execution Time"?: number },
  ];
  return { plan: doc[0].Plan, ms: doc[0]["Execution Time"] ?? null };
}

const TOP_SQL = String.raw`SELECT coalesce(json_agg(t), '[]') FROM (SELECT query FROM pg_stat_statements
  WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND query ~* '^\s*select' AND query !~* 'pg_stat|pg_catalog|pg_class|pg_namespace|pg_rotate|information_schema|_prisma_migrations|^\s*select \$1'
  ORDER BY total_exec_time DESC LIMIT ${EXPLAIN_LIMIT}) t`;

function summary(n: PlanNode): string {
  return nodes(n)
    .map((x) => x["Node Type"])
    .join(" > ");
}

function indexCovers(table: string, column: string): boolean {
  const defs = psql(
    `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${table}'`,
  );
  return defs
    .split("\n")
    .some((d) => d.includes(`("${column}"`) || d.includes(`(${column}`));
}

function trialIndex(
  sql: string,
  table: string,
  columns: readonly string[],
  base: Explained,
): Candidate {
  const quoted = columns.map((c) => `"${c}"`).join(", ");
  const create = `CREATE INDEX idx_trial ON "${table}" (${quoted});`;
  const after = explain(sql, `${create}\n`);
  const off = explain(sql, `${create}\nSET LOCAL enable_seqscan = off;\n`);
  return {
    index: `CREATE INDEX ON "${table}" (${quoted});`,
    after: `${summary(after.plan)} (${String(after.ms)} ms)`,
    afterNoSeqScan: `${summary(off.plan)} (${String(off.ms)} ms)`,
    costBefore: base.plan["Total Cost"],
    costAfter: off.plan["Total Cost"],
  };
}

function analyse(item: Item, sql: string): Item {
  const base = explain(sql);
  const all = nodes(base.plan);
  const scan = all.find(
    (n) => n["Node Type"] === "Seq Scan" && n.Filter && n["Relation Name"],
  );
  const next: Item = {
    ...item,
    plan: describe(all),
    executionMs: base.ms,
    usesSeqScan: all.some((n) => n["Node Type"] === "Seq Scan"),
  };
  const table = scan?.["Relation Name"];
  const columns = filterColumns(scan?.Filter ?? "");
  const first = columns[0];
  if (!table || first === undefined) return next;
  if (indexCovers(table, first))
    return {
      ...next,
      note: `an index with leading column ${first} already exists on ${table}`,
    };
  return { ...next, candidate: trialIndex(sql, table, columns, base) };
}

function run(query: string, index: Map<string, Logged>): Item {
  const item: Item = {
    query: collapse(query),
    plan: "",
    usesSeqScan: false,
    executionMs: null,
    candidate: null,
    note: "",
  };
  const logged = index.get(signature(query));
  if (!logged)
    return {
      ...item,
      note: "no logged execution to take parameter values from",
    };
  try {
    return analyse(item, withParameters(logged));
  } catch (error) {
    const reason = String(error).split("\n")[0] ?? "";
    return { ...item, note: `explain failed: ${reason}` };
  }
}

const outFile = process.argv[2];
if (!outFile) throw new Error("usage: explain.ts <output.json>");
const statements = JSON.parse(psql(TOP_SQL)) as { query: string }[];
const index = indexLog(postgresLog());
const items = statements.map(({ query }) => run(query, index));
writeFileSync(outFile, JSON.stringify(items, null, 1));
console.log(`${outFile}: ${String(items.length)} statements`);
