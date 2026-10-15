import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { matrix } from "./coverage.ts";
import { renderMarkdown } from "./report.ts";
import type { MissingOutput, RoleResult } from "./types.ts";

type Part = Readonly<{
  url: string;
  started: string;
  wallMs: number;
  results: readonly RoleResult[];
  missing?: readonly MissingOutput[];
}>;

function prefixed(result: RoleResult, prefix: string): RoleResult {
  const shot = (path: string | null): string | null =>
    path ? `${prefix}/${path}` : null;
  return {
    ...result,
    runs: result.runs.map((run) => ({
      ...run,
      video: run.video ? `${prefix}/${run.video}` : null,
      findings: run.findings.map((f) => ({ ...f, shot: shot(f.shot) })),
      pages: run.pages.map((page) => ({
        ...page,
        shot: shot(page.shot),
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
    .flatMap(directories);
}

// shortcut: checks each result's runs list, not every nested record; deeper damage still fails the merge.
function isPart(value: unknown): value is Part {
  if (typeof value !== "object" || value === null) return false;
  const { results, missing } = value as Record<string, unknown>;
  return (
    Array.isArray(results) &&
    results.every((result: unknown) =>
      Array.isArray((result as { runs?: unknown } | null)?.runs),
    ) &&
    (missing === undefined ||
      (Array.isArray(missing) &&
        missing.every((entry: unknown) => {
          const { role, reason } = (entry ?? {}) as Record<string, unknown>;
          return typeof role === "string" && typeof reason === "string";
        })))
  );
}

// A pass report that cannot be used becomes a missing entry; the raw file is left as found.
function readPart(
  root: string,
  dir: string,
): Readonly<{ part: Part | null; reason: string }> {
  const file = join(root, dir, REPORT);
  if (!existsSync(file)) return { part: null, reason: "no report.json" };
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    return { part: null, reason: `unreadable report.json (${code})` };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { part: null, reason: "invalid report.json" };
  }
  return isPart(value)
    ? { part: value, reason: "" }
    : { part: null, reason: "not a crawl report" };
}

function parts(root: string): Readonly<{
  all: readonly (readonly [string, Part])[];
  missing: readonly MissingOutput[];
}> {
  const all: (readonly [string, Part])[] = [];
  const missing: MissingOutput[] = [];
  for (const dir of passDirs(root)) {
    const { part, reason } = readPart(root, dir);
    if (part === null) {
      missing.push({ role: dir, reason });
      continue;
    }
    all.push([dir, part]);
    for (const entry of part.missing ?? [])
      missing.push({ role: `${dir}/${entry.role}`, reason: entry.reason });
  }
  return { all, missing };
}

/** Joins the per-state, per-pass crawl reports of a full walk into one report with the element x state matrix. */
export function mergeReports(
  root: string,
): Readonly<{ passes: number; missing: readonly MissingOutput[] }> {
  const { all, missing } = parts(root);
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
    missing,
  };
  writeFileSync(
    join(root, REPORT),
    JSON.stringify({ ...meta, results, matrix: matrix(results) }, null, 2),
  );
  writeFileSync(join(root, "report.md"), renderMarkdown(meta, results));
  return { passes: all.length, missing };
}

if (import.meta.main) {
  const root = process.argv[2];
  if (!root) throw new Error("Usage: merge.ts <full-walk-output-dir>");
  const { passes, missing } = mergeReports(root);
  console.log(`Merged ${passes} crawl pass(es) into ${root}/report.md`);
  if (missing.length > 0) {
    console.error(
      `Incomplete full walk: ${missing.length} expected output(s) missing; see report`,
    );
    process.exitCode = 1;
  }
}
