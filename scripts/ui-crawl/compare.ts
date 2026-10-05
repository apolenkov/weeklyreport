import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PageRecord, RoleResult } from "./types.ts";

type Report = Readonly<{ results: readonly RoleResult[] }>;

/** Pressed, skipped and gone counts of one role at one width, and per page. */
export type RunCounts = Readonly<{
  pressed: number;
  skipped: number;
  gone: number;
  pages: Readonly<Record<string, number>>;
}>;

const isGone = (reason: string | null): boolean =>
  reason?.startsWith("gone") === true || reason === "gone";

function pressedOn(page: PageRecord): number {
  return page.steps.filter((step) => step.action === "pressed").length;
}

/** Counts per `role@width`: two runs of the same state must agree on every number. */
export function countRuns(report: Report): ReadonlyMap<string, RunCounts> {
  const counts = new Map<string, RunCounts>();
  for (const result of report.results)
    for (const run of result.runs) {
      const steps = run.pages.flatMap((page) => page.steps);
      counts.set(`${run.role}@${run.width}`, {
        pressed: steps.filter((step) => step.action === "pressed").length,
        skipped: steps.filter((step) => step.action !== "pressed").length,
        gone: steps.filter((step) => isGone(step.reason)).length,
        pages: Object.fromEntries(
          run.pages.map((page) => [page.key, pressedOn(page)]),
        ),
      });
    }
  return counts;
}

/** Lines that name every run and page whose counts differ; empty when the runs agree. */
export function differences(
  first: ReadonlyMap<string, RunCounts>,
  second: ReadonlyMap<string, RunCounts>,
): readonly string[] {
  const lines: string[] = [];
  for (const key of new Set([...first.keys(), ...second.keys()])) {
    const a = first.get(key);
    const b = second.get(key);
    if (!a || !b) {
      lines.push(`${key}: present in one run only`);
      continue;
    }
    if (a.pressed !== b.pressed || a.gone !== b.gone)
      lines.push(
        `${key}: pressed ${a.pressed} vs ${b.pressed}, gone ${a.gone} vs ${b.gone}`,
      );
    for (const page of new Set([
      ...Object.keys(a.pages),
      ...Object.keys(b.pages),
    ]))
      if (a.pages[page] !== b.pages[page])
        lines.push(
          `  ${page}: ${String(a.pages[page])} vs ${String(b.pages[page])}`,
        );
  }
  return lines;
}

function load(directory: string): Report {
  return JSON.parse(
    readFileSync(join(directory, "report.json"), "utf8"),
  ) as Report;
}

if (import.meta.main) {
  const [one, two] = process.argv.slice(2);
  if (!one || !two) throw new Error("Usage: compare.ts <run-dir> <run-dir>");
  const first = countRuns(load(one));
  const second = countRuns(load(two));
  for (const [key, a] of [...first].toSorted((x, y) =>
    x[0].localeCompare(y[0]),
  )) {
    const b = second.get(key);
    console.log(
      `${key}: pressed ${a.pressed} / ${String(b?.pressed)}, skipped ${a.skipped} / ${String(b?.skipped)}, gone ${a.gone} / ${String(b?.gone)}`,
    );
  }
  const lines = differences(first, second);
  console.log(lines.length === 0 ? "IDENTICAL" : lines.join("\n"));
  process.exitCode = lines.length === 0 ? 0 : 1;
}
