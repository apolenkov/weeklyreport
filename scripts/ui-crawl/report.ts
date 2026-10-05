import { MS_PER_SECOND, P95 } from "./constants.ts";
import type { Finding, PageRecord, RoleResult, RunRecord } from "./types.ts";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function countBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function pageLine(p: PageRecord): string {
  return `${p.key} (${p.controlsFound} controls, load ${p.loadMs} ms)`;
}

function seconds(ms: number): string {
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

function runRow(run: RunRecord): string {
  const steps = run.pages.flatMap((p) => p.steps);
  const pressed = steps.filter((s) => s.action === "pressed").length;
  const skipped = steps.filter((s) => s.action === "skipped").length;
  const errors = steps.filter((s) => s.action === "error").length;
  const responses = steps
    .flatMap((s) => (s.responseMs === null ? [] : [s.responseMs]))
    .sort((a, b) => a - b);
  const p95 = responses[Math.floor(responses.length * P95)] ?? 0;
  return `| ${run.role} | ${run.width} | ${run.pages.length} | ${pressed} | ${skipped} | ${errors} | ${p95} ms | ${seconds(run.ms)} | [${run.video}](${run.video}) |`;
}

function findingGroups(findings: readonly Finding[]): string[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings)
    groups.set(`${f.kind}|${f.page}|${f.detail}`, [
      ...(groups.get(`${f.kind}|${f.page}|${f.detail}`) ?? []),
      f,
    ]);
  return [...groups.values()]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a[0]?.severity ?? "low"] -
        SEVERITY_ORDER[b[0]?.severity ?? "low"],
    )
    .map((g) => {
      const f = g[0] as Finding;
      const where = [...new Set(g.map((x) => `${x.role}@${x.width}`))].join(
        ", ",
      );
      const shot = f.shot ? ` [shot](${f.shot})` : "";
      return `- **${f.severity}** \`${f.kind}\` ${f.page} — ${f.detail} (${where})${shot}`;
    });
}

export function renderMarkdown(
  meta: { url: string; wallMs: number; started: string; parallel: number },
  results: readonly RoleResult[],
): string {
  const runs = results.flatMap((r) => r.runs);
  const findings = runs.flatMap((r) => r.findings);
  const skips = countBy(
    runs
      .flatMap((r) => r.pages.flatMap((p) => p.steps))
      .filter((s) => s.action === "skipped"),
    (s) => (s.reason ?? "").replace(/^cap.*/, "cap"),
  );
  return [
    "# UI crawl report",
    "",
    `Target ${meta.url}, started ${meta.started}. Wall time for all roles (parallel ${meta.parallel}): **${seconds(meta.wallMs)}**.`,
    `Sequential sum of role times: ${seconds(results.reduce((a, r) => a + r.ms, 0))}.`,
    "",
    "| role | width | pages | pressed | skipped | click errors | p95 response | time | video |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...runs.map(runRow),
    "",
    "## Skipped controls by reason",
    ...skips.map(([reason, n]) => `- ${reason}: ${n}`),
    "",
    `## Findings (${findings.length} raw, grouped below)`,
    ...countBy(findings, (f) => f.kind).map(([kind, n]) => `- ${kind}: ${n}`),
    "",
    "### Detail",
    ...findingGroups(findings),
    "",
    "## Pages",
    ...runs.map(
      (r) => `- ${r.role}@${r.width}: ${r.pages.map(pageLine).join("; ")}`,
    ),
    "",
  ].join("\n");
}
