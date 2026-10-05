import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MS_PER_SECOND, SLOW_LIST } from "./constants.ts";
import { text } from "./logs.ts";
import type { RunDir } from "./run-dir.ts";

interface Context {
  role: string;
  width: string;
  page: string;
}
interface Slow {
  ms: number;
  label: string;
}

function contextOf(o: Record<string, unknown>, ctx: Context): Context {
  return {
    role: typeof o.role === "string" ? o.role : ctx.role,
    width: typeof o.width === "number" ? String(o.width) : ctx.width,
    page: typeof o.url === "string" ? o.url : ctx.page,
  };
}

function timings(o: Record<string, unknown>, where: string): Slow[] {
  const found: Slow[] = [];
  if (typeof o.loadMs === "number")
    found.push({ ms: o.loadMs, label: `load ${where}` });
  if (typeof o.responseMs === "number" && typeof o.name === "string")
    found.push({ ms: o.responseMs, label: `press "${o.name}" ${where}` });
  return found;
}

function visit(value: unknown, ctx: Context, slow: Slow[]): void {
  if (Array.isArray(value)) {
    for (const v of value) visit(v, ctx, slow);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const o = value as Record<string, unknown>;
  const next = contextOf(o, ctx);
  slow.push(...timings(o, `${next.role}/${next.width} ${next.page}`));
  for (const v of Object.values(o)) visit(v, next, slow);
}

/** Wall time of one crawler report and its slowest page loads and presses. */
export function crawlSummary(
  run: RunDir,
  dir: string,
): { line: string; slow: string[] } {
  if (!run.exists(`${dir}/report.json`))
    return { line: `_${dir}: no report.json_`, slow: [] };
  const rep = JSON.parse(
    readFileSync(join(run.path, dir, "report.json"), "utf8"),
  ) as { wallMs?: number; results?: unknown };
  const slow: Slow[] = [];
  visit(rep.results, { role: "", width: "", page: "" }, slow);
  const seconds = Math.round((rep.wallMs ?? 0) / MS_PER_SECOND);
  return {
    line: `${dir}: wall ${text(seconds)} s, report \`${dir}/report.md\``,
    slow: slow
      .toSorted((a, b) => b.ms - a.ms)
      .slice(0, SLOW_LIST)
      .map((s) => `${text(s.ms)} ms: ${s.label}`),
  };
}
