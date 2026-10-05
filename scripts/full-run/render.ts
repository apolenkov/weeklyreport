import {
  CELL_MAX,
  DECIMALS,
  FIRST_LINES,
  LAST_CHARS,
  PROCEDURES_SHOWN,
  TOP_N,
} from "./constants.ts";
import type { RouterCoverage } from "./coverage.ts";
import type { ExplainItem, Grouped } from "./database.ts";
import type { Statement, TableStat } from "./pg.ts";
import type { ProcedureRow, RouteRow } from "./procedures.ts";

const ms = (n: number): string => n.toFixed(DECIMALS);
const cell = (s: string): string => {
  const flat = s.replaceAll("|", String.raw`\|`).replaceAll("\n", " ");
  return flat.length <= CELL_MAX
    ? flat
    : `${flat.slice(0, FIRST_LINES)} ... ${flat.slice(-LAST_CHARS)}`;
};
const num = (n: number | null): string => (n === null ? "n/a" : String(n));

export function procedureSection(rows: readonly ProcedureRow[]): string[] {
  const called = rows.filter((r) => r.called).length;
  const reachable = rows.filter((r) => r.called || r.screens.length > 0);
  const calledReachable = reachable.filter((r) => r.called).length;
  const out = [
    "## 1. tRPC procedures",
    "",
    "Method: the api logs one `trpc request start` line per call (procedure, role), Prometheus counters back it up; V8 function coverage cannot name a procedure because the production build has no source maps, so it is kept as a per-router cross-check below. Procedures are enumerated from the real `createAppRouter`; the screen is the web source that calls the procedure.",
    "",
    `Total: **${num(rows.length)}**, called: **${num(called)}**, not called: **${num(rows.length - called)}**. Of those with a web caller or a call: **${num(calledReachable)}/${num(reachable.length)}**.`,
    "",
    "| procedure | type | called | calls | roles | screen (web source) | reason if not called |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows)
    out.push(
      `| ${r.path} | ${r.type} | ${r.called ? "yes" : "NO"} | ${num(r.calls)} | ${r.roles.join(", ")} | ${cell(r.screens.join("; "))} | ${r.reason} |`,
    );
  return out;
}

const ROUTE_NOTES: Readonly<Record<string, string>> = {
  "GET /health/pdf-renderer": "operations probe, no screen calls it",
  "POST /api/web-vitals": "browser beacon, not seen in this run",
  "GET /admin/queues": "Bull Board, not opened by the crawler",
  "GET /metrics": "Prometheus scrape (collected by the run itself)",
};

export function routeSection(
  routes: readonly RouteRow[],
  errors: readonly [string, number][],
): string[] {
  const out = [
    "",
    "## 2. HTTP routes",
    "",
    "Counters come from Prometheus and the access log; auth routes share the `/auth/*` counter.",
    "",
    "| route | calls | note |",
    "|---|---|---|",
  ];
  for (const r of routes) {
    const note = r.calls === 0 ? (ROUTE_NOTES[r.route] ?? "not called") : "";
    out.push(`| ${r.route} | ${num(r.calls)} | ${note} |`);
  }
  out.push("", "## 2a. Api errors and warnings (log level warn and error)", "");
  if (errors.length === 0) out.push("_none_");
  for (const [msg, n] of errors) out.push(`- x${num(n)} ${cell(msg)}`);
  return out;
}

export function coverageSection(coverage: readonly RouterCoverage[]): string[] {
  const out = [
    "",
    "## 3. V8 coverage per router file (cross-check)",
    "",
    "| router file | functions run | functions total |",
    "|---|---|---|",
  ];
  for (const c of coverage)
    out.push(`| ${c.file} | ${num(c.run)} | ${num(c.total)} |`);
  if (coverage.length === 0) out.push("| (no coverage files collected) | | |");
  return out;
}

export function statementSections(
  byTotal: readonly Statement[],
  byMean: readonly Statement[],
  frequent: readonly Statement[],
  totalRequests: number,
): string[] {
  const out = [
    "",
    `## 4. Database: top ${num(TOP_N)} by total_exec_time`,
    "",
    "| total ms | calls | mean ms | query |",
    "|---|---|---|---|",
  ];
  for (const s of byTotal)
    out.push(
      `| ${ms(s.total_exec_time)} | ${num(s.calls)} | ${ms(s.mean_exec_time)} | ${cell(s.query)} |`,
    );
  out.push(
    "",
    `Per-request overhead: ${num(totalRequests)} tRPC calls in the run; the ${num(PROCEDURES_SHOWN)} most frequent statements:`,
    "",
  );
  for (const s of frequent) {
    const perRequest = ms(s.calls / Math.max(totalRequests, 1));
    out.push(
      `- ${num(s.calls)} calls (${perRequest} per request, mean ${ms(s.mean_exec_time)} ms): \`${cell(s.query)}\``,
    );
  }
  out.push(
    "",
    `## 5. Database: top ${num(TOP_N)} by mean_exec_time (calls >= 3)`,
    "",
    "| mean ms | calls | max ms | query |",
    "|---|---|---|---|",
  );
  for (const s of byMean)
    out.push(
      `| ${ms(s.mean_exec_time)} | ${num(s.calls)} | ${ms(s.max_exec_time)} | ${cell(s.query)} |`,
    );
  return out;
}

export function tableSection(tables: readonly TableStat[]): string[] {
  const out = [
    "",
    "## 6. Tables: seq_scan against idx_scan",
    "",
    "| table | rows | seq_scan | seq_tup_read | idx_scan |",
    "|---|---|---|---|---|",
  ];
  for (const t of tables)
    out.push(
      `| ${t.relname} | ${num(t.n_live_tup)} | ${num(t.seq_scan)} | ${num(t.seq_tup_read)} | ${num(t.idx_scan)} |`,
    );
  return out;
}

export function explainSection(explain: readonly ExplainItem[]): string[] {
  const out = [
    "",
    "## 7. Index candidates (EXPLAIN ANALYZE, BUFFERS on the stand data)",
    "",
  ];
  if (explain.length === 0)
    out.push("_no explain results (the explain step did not run)_");
  for (const e of explain) {
    out.push(
      `- \`${cell(e.query)}\``,
      `  - seq scan: ${e.usesSeqScan ? "yes" : "no"}, execution ${num(e.executionMs)} ms. ${e.note}`,
    );
    if (e.candidate)
      out.push(
        `  - candidate \`${e.candidate.index}\`: cost ${num(e.candidate.costBefore)} -> ${num(e.candidate.costAfter)} (planner default: ${e.candidate.after}; seq scan off: ${e.candidate.afterNoSeqScan})`,
      );
  }
  return out;
}

export function nPlusOneSection(groups: readonly Grouped[]): string[] {
  const out = [
    "",
    "## 8. N+1 candidates (same statement, same backend, 5 or more times within 300 ms)",
    "",
  ];
  if (groups.length === 0) out.push("_none found_");
  for (const r of groups) {
    const procedures = [...r.procedures].slice(0, PROCEDURES_SHOWN).join(", ");
    out.push(
      `- ${num(r.windows)} windows, up to x${num(r.max)}: \`${cell(r.sql)}\` while ${procedures} (roles run in parallel, so this is a candidate list)`,
    );
  }
  return out;
}

export function crawlSection(
  quick: { line: string; slow: string[] },
  full: { line: string; slow: string[] },
): string[] {
  return [
    "",
    "## 9. Crawler",
    "",
    `- ${quick.line}`,
    `- ${full.line}`,
    "",
    "Slowest quick steps:",
    ...quick.slow.map((s) => `- ${s}`),
    "",
    "Slowest full steps:",
    ...full.slow.map((s) => `- ${s}`),
  ];
}
