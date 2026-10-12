import { MS_PER_SECOND, P95 } from "./constants.ts";
import { matrix, pageCoverage, pivot } from "./coverage.ts";
import type { Finding, PageRecord, RoleResult, RunRecord } from "./types.ts";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
type Metadata = Readonly<{
  url: string;
  wallMs: number;
  started: string;
  parallel: number;
  mode?: string;
  state?: string;
}>;
type TableCell = string | number;

function countBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function cell(value: TableCell): string {
  return String(value)
    .replaceAll("|", String.raw`\|`)
    .replaceAll(/\r?\n/g, " ");
}

// Observed text stays inside its report entry; structured evidence is unchanged.
function markdownText(value: string): string {
  return value
    .replaceAll(/[\\`*_{}[\]()#+.!<>~&-]/g, String.raw`\$&`)
    .replaceAll(/\r\n?|\n/g, " ");
}

function table(
  headers: readonly string[],
  rows: readonly (readonly TableCell[])[],
): string[] {
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ];
}

function pageLine(page: PageRecord): string {
  return `${markdownText(page.key)} (${page.controlsFound} controls, load ${page.loadMs} ms)`;
}

function seconds(ms: number): string {
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

function runRow(run: RunRecord): readonly TableCell[] {
  const steps = run.pages.flatMap((page) => page.steps);
  const counts = pageCoverage(steps);
  const responses = steps
    .flatMap((step) => (step.responseMs === null ? [] : [step.responseMs]))
    .sort((a, b) => a - b);
  const p95 = responses[Math.ceil(responses.length * P95) - 1];
  const percentile = p95 === undefined ? "not measured" : `${p95} ms`;
  const video = run.video ? `[${run.video}](${run.video})` : "none";
  return [
    run.role,
    run.state ?? "observed",
    run.width,
    run.pages.length,
    counts.pressed,
    counts.skipped,
    counts.errors,
    `${percentile} (n=${responses.length})`,
    seconds(run.ms),
    video,
  ];
}

function findingGroups(findings: readonly Finding[]): string[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = JSON.stringify([finding.kind, finding.page, finding.detail]);
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a[0]?.severity ?? "low"] -
        SEVERITY_ORDER[b[0]?.severity ?? "low"],
    )
    .map((group) => {
      const finding = group[0] as Finding;
      const where = [
        ...new Set(group.map((item) => `${item.role}@${item.width}`)),
      ].join(", ");
      const shot = finding.shot ? ` [shot](${finding.shot})` : "";
      return `- **${finding.severity}** \`${finding.kind}\` ${markdownText(finding.page)} — ${markdownText(finding.detail)} (${where})${shot}`;
    });
}

function pageRows(run: RunRecord): readonly (readonly TableCell[])[] {
  return run.pages.map((page) => {
    const counts = page.coverage ?? pageCoverage(page.steps);
    return [
      run.role,
      run.width,
      markdownText(page.key),
      page.state ?? "observed",
      page.completion ?? "unreported",
      counts.found,
      counts.pressed,
      counts.skipped,
      counts.errors,
      markdownText(JSON.stringify(counts.reasons)),
    ];
  });
}

function pairwiseRow(page: PageRecord): readonly TableCell[] {
  const assignments = page.pairwise;
  if (assignments === undefined) return ["not collected", "—", "—", "—", ""];
  const observed = assignments.filter(
    (item) => item.status === "observed",
  ).length;
  const skipped = assignments.filter(
    (item) => item.status === "skipped",
  ).length;
  const errors = assignments.filter((item) => item.status === "error").length;
  const reasons = countBy(
    assignments.filter((item) => item.status !== "observed"),
    (item) => `${item.status}: ${item.reason ?? "unspecified"}`,
  );
  return [
    assignments.length,
    observed,
    skipped,
    errors,
    markdownText(JSON.stringify(Object.fromEntries(reasons))),
  ];
}

function coverageTables(runs: readonly RunRecord[]): readonly string[] {
  return [
    "## Page coverage",
    "",
    ...table(
      [
        "role",
        "width",
        "page",
        "state",
        "completion",
        "found",
        "pressed",
        "skipped",
        "errors",
        "reasons",
      ],
      runs.flatMap(pageRows),
    ),
    "",
    "## Pairwise filter coverage",
    "",
    ...table(
      [
        "role",
        "width",
        "page",
        "state",
        "planned",
        "observed",
        "skipped",
        "errors",
        "reasons",
      ],
      runs.flatMap((run) =>
        run.pages.map((page) => [
          run.role,
          run.width,
          markdownText(page.key),
          page.state ?? "observed",
          ...pairwiseRow(page),
        ]),
      ),
    ),
    "",
  ];
}

function matrixTable(results: readonly RoleResult[]): readonly string[] {
  const { states, rows } = pivot(matrix(results));
  return [
    "## Element × state",
    "",
    "P pressed, S skipped (reason in report.json), E error, — not present in that state. One cell per element over widths and depths.",
    "",
    ...table(
      ["role", "page", "element", ...states],
      rows.map((row) => [
        row.role,
        markdownText(row.page),
        markdownText(row.element),
        ...states.map((state) => row.cells.get(state) ?? "—"),
      ]),
    ),
    "",
  ];
}

function skippedControls(runs: readonly RunRecord[]): readonly string[] {
  const steps = runs.flatMap((run) => run.pages.flatMap((page) => page.steps));
  return countBy(
    steps.filter((step) => step.action === "skipped"),
    (step) => (step.reason ?? "unspecified").replace(/^cap.*/, "cap"),
  ).map(([reason, count]) => `- ${markdownText(reason)}: ${count}`);
}

export function renderMarkdown(
  meta: Metadata,
  results: readonly RoleResult[],
): string {
  const runs = results.flatMap((result) => result.runs);
  const findings = runs.flatMap((run) => run.findings);
  return [
    "# UI crawl report",
    "",
    `Target ${markdownText(meta.url)}, started ${meta.started}. Wall time for all roles (parallel ${meta.parallel}): **${seconds(meta.wallMs)}**.`,
    `Mode: ${meta.mode ?? "quick"}; prepared state: ${meta.state ?? "observed"}. Pressed means attempted with an observed result, not a product acceptance PASS.`,
    `Sequential sum of role times: ${seconds(results.reduce((sum, result) => sum + result.ms, 0))}.`,
    "",
    ...table(
      [
        "role",
        "state",
        "width",
        "pages",
        "pressed",
        "skipped",
        "click errors",
        "p95 response",
        "time",
        "video",
      ],
      runs.map(runRow),
    ),
    "",
    "## Skipped controls by reason",
    "",
    ...skippedControls(runs),
    "",
    `## Findings (${findings.length} raw, grouped below)`,
    "",
    ...countBy(findings, (finding) => finding.kind).map(
      ([kind, count]) => `- ${kind}: ${count}`,
    ),
    "",
    "### Detail",
    "",
    ...findingGroups(findings),
    "",
    "## Pages",
    "",
    ...runs.map(
      (run) =>
        `- ${run.role}@${run.width}: ${run.pages.map(pageLine).join("; ")}`,
    ),
    "",
    ...coverageTables(runs),
    ...matrixTable(results),
  ].join("\n");
}
