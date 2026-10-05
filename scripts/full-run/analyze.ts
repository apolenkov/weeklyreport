// Builds report.md / report.json for a full-run directory (see deploy/tester-kit/full-run.sh).
// Usage: analyze.ts <run-dir>
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { PROCEDURES_SHOWN } from "./constants.ts";
import { coverageByRouter } from "./coverage.ts";
import { crawlSummary } from "./crawl-summary.ts";
import { loadExplain, loadStatistics, nPlusOne } from "./database.ts";
import { dogfoodSection } from "./dogfood-summary.ts";
import { intervals, metricsCalls, procedureCalls } from "./logs.ts";
import { OWN_QUERIES } from "./pg.ts";
import {
  errorSummary,
  type Procedure,
  procedureRows,
  routeRows,
} from "./procedures.ts";
import {
  coverageSection,
  crawlSection,
  explainSection,
  nPlusOneSection,
  procedureSection,
  routeSection,
  statementSections,
  tableSection,
} from "./render.ts";
import { openRun } from "./run-dir.ts";

const runPath = process.argv[2];
if (!runPath) throw new Error("usage: analyze.ts <run-dir>");
const run = openRun(runPath);

const apiLines = run
  .files("segments", /^api-\d+\.log$/)
  .flatMap((f) => run.read(`segments/${f}`).split("\n"));
const metrics = new Map<string, number>();
for (const f of run.files("segments", /^metrics-\d+\.txt$/))
  for (const [k, v] of metricsCalls(run.read(`segments/${f}`)))
    metrics.set(k, (metrics.get(k) ?? 0) + v);

// Prometheus counters back up the log: a procedure counted there is called even if its log line was lost.
const used = procedureCalls(apiLines);
for (const [k, v] of metrics) {
  const path = /^\w+ \/trpc\/(.+)$/.exec(k)?.[1];
  if (path && !used.has(path))
    used.set(path, { calls: v, roles: new Set(["(metrics only)"]) });
}

const procedures = JSON.parse(run.read("procedures.json")) as Procedure[];
const rows = procedureRows(procedures, used);
const routes = routeRows(apiLines, metrics);
const errors = errorSummary(apiLines);
const coverage = coverageByRouter(
  run
    .files("segments", /^cov-(?!00)\d+$/)
    .map((d) => join(runPath, "segments", d)),
);
const stats = loadStatistics(run);
const groups = nPlusOne(run, intervals(apiLines));
const explain = loadExplain(run);
const totalRequests = [...used.values()].reduce((n, u) => n + u.calls, 0);
const frequent = stats.statements
  .filter((s) => !OWN_QUERIES.test(s.query))
  .toSorted((a, b) => b.calls - a.calls)
  .slice(0, PROCEDURES_SHOWN);

const improve = run.exists("improve.md")
  ? run.read("improve.md").trim()
  : "_see the run summary_";
const timings = run.exists("timings.txt") ? run.read("timings.txt").trim() : "";
const md = [
  "# Full run report",
  "",
  `Run directory: \`${runPath}\``,
  "",
  "## Timings",
  "",
  "```",
  timings,
  "```",
  "",
  ...procedureSection(rows),
  ...routeSection(routes, errors),
  ...coverageSection(coverage),
  ...statementSections(stats.byTotal, stats.byMean, frequent, totalRequests),
  ...tableSection(stats.tables),
  ...explainSection(explain),
  ...nPlusOneSection(groups),
  ...crawlSection(crawlSummary(run, "quick"), crawlSummary(run, "full")),
  ...dogfoodSection(run),
  ...(run.exists("e2e.txt")
    ? ["", "## 11. e2e", "", run.read("e2e.txt").trim()]
    : []),
  "",
  "## 12. What to improve",
  "",
  improve,
  "",
];
writeFileSync(join(runPath, "report.md"), md.join("\n"));
writeFileSync(
  join(runPath, "report.json"),
  JSON.stringify(
    {
      procedures: rows,
      routes,
      coverage,
      byTotal: stats.byTotal,
      byMean: stats.byMean,
      tables: stats.tables,
      nPlusOne: groups.map((g) => ({ ...g, procedures: [...g.procedures] })),
      explain,
    },
    null,
    1,
  ),
);
const calledCount = rows.filter((r) => r.called).length;
console.log(
  `procedures ${String(calledCount)}/${String(rows.length)}; report ${join(runPath, "report.md")}`,
);
