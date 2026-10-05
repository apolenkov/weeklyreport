import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { matrix } from "./coverage.ts";
import { renderMarkdown } from "./report.ts";
import type { RoleResult } from "./types.ts";

type Part = Readonly<{
  url: string;
  started: string;
  wallMs: number;
  results: readonly RoleResult[];
}>;

function prefixed(result: RoleResult, prefix: string): RoleResult {
  const shot = (path: string | null): string | null =>
    path ? `${prefix}/${path}` : null;
  return {
    ...result,
    runs: result.runs.map((run) => ({
      ...run,
      video: run.video ? `${prefix}/${run.video}` : "",
      findings: run.findings.map((f) => ({ ...f, shot: shot(f.shot) })),
      pages: run.pages.map((page) => ({
        ...page,
        shot: shot(page.shot) ?? "",
        steps: page.steps.map((s) => ({ ...s, shot: shot(s.shot) })),
        ...(page.states
          ? {
              states: page.states.map((s) => ({
                ...s,
                shot: shot(s.shot) ?? "",
                ...(s.dom ? { dom: shot(s.dom) ?? "" } : {}),
              })),
            }
          : {}),
        ...(page.pairwise
          ? {
              pairwise: page.pairwise.map((p) => ({
                ...p,
                shot: shot(p.shot),
              })),
            }
          : {}),
      })),
    })),
  };
}

const REPORT = "report.json";

function passDirs(root: string): readonly string[] {
  const directories = (dir: string): readonly string[] =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name))
      .toSorted((a, b) => a.localeCompare(b));
  return directories("")
    .filter((dir) => dir.startsWith("state-"))
    .flatMap(directories)
    .filter((dir) => existsSync(join(root, dir, REPORT)));
}

function parts(root: string): readonly (readonly [string, Part])[] {
  return passDirs(root).map(
    (dir) =>
      [
        dir,
        JSON.parse(readFileSync(join(root, dir, REPORT), "utf8")) as Part,
      ] as const,
  );
}

/** Joins the per-state, per-pass crawl reports of a full walk into one report with the element x state matrix. */
export function mergeReports(root: string): number {
  const all = parts(root);
  const results = all.flatMap(([dir, part]) =>
    part.results.map((result) => prefixed(result, dir)),
  );
  const first = all[0]?.[1];
  const wallMs = all.reduce((sum, [, part]) => sum + part.wallMs, 0);
  const meta = {
    url: first?.url ?? "",
    started: first?.started ?? "",
    wallMs,
    parallel: 1,
    mode: "full",
    state: all.length > 0 ? "all prepared states" : "none",
  };
  writeFileSync(
    join(root, REPORT),
    JSON.stringify({ ...meta, results, matrix: matrix(results) }, null, 2),
  );
  writeFileSync(join(root, "report.md"), renderMarkdown(meta, results));
  return all.length;
}

if (import.meta.main) {
  const root = process.argv[2];
  if (!root) throw new Error("Usage: merge.ts <full-walk-output-dir>");
  console.log(
    `Merged ${mergeReports(root)} crawl pass(es) into ${root}/report.md`,
  );
}
