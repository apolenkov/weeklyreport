import type { RoleResult, StepRecord } from "./types.ts";

type PageCoverage = Readonly<{
  found: number;
  pressed: number;
  skipped: number;
  errors: number;
  reasons: Readonly<Record<string, number>>;
}>;

type MatrixRow = Readonly<{
  role: string;
  width: number;
  page: string;
  state: string;
  elementId: string;
  name: string;
  action: StepRecord["action"];
  reason: string | null;
}>;

export function pageCoverage(steps: readonly StepRecord[]): PageCoverage {
  const reasons = new Map<string, number>();
  const counts = { pressed: 0, skipped: 0, error: 0 };
  for (const step of steps) {
    counts[step.action] += 1;
    if (step.action === "skipped") {
      const reason = step.reason ?? "unspecified";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  return {
    found: steps.length,
    pressed: counts.pressed,
    skipped: counts.skipped,
    errors: counts.error,
    reasons: Object.fromEntries(reasons),
  };
}

export function matrix(results: readonly RoleResult[]): readonly MatrixRow[] {
  return results
    .flatMap((result) => result.runs)
    .flatMap((run) =>
      run.pages.flatMap((page) =>
        page.steps.map((step) => ({
          role: run.role,
          width: run.width,
          page: page.key,
          state: step.state ?? page.state ?? "observed",
          elementId: step.elementId ?? `${step.tag}:${step.name}`,
          name: step.name,
          action: step.action,
          reason: step.reason,
        })),
      ),
    );
}

type PivotRow = Readonly<{
  role: string;
  page: string;
  element: string;
  cells: ReadonlyMap<string, string>;
}>;

export type Pivot = Readonly<{
  states: readonly string[];
  rows: readonly PivotRow[];
}>;

const RANK = { error: 2, pressed: 1, skipped: 0 } as const;
const MARK = { error: "E", pressed: "P", skipped: "S" } as const;

/** Element x state: one cell per element and state, the strongest outcome over widths and depths (P pressed, S skipped, E error). */
export function pivot(rows: readonly MatrixRow[]): Pivot {
  const states = [...new Set(rows.map((row) => row.state))];
  const best = new Map<string, MatrixRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.role, row.page, row.name, row.state]);
    const seen = best.get(key);
    if (!seen || RANK[row.action] > RANK[seen.action]) best.set(key, row);
  }
  const grouped = new Map<string, Map<string, string>>();
  for (const row of best.values()) {
    const key = JSON.stringify([row.role, row.page, row.name]);
    const cells = grouped.get(key) ?? new Map<string, string>();
    cells.set(row.state, MARK[row.action]);
    grouped.set(key, cells);
  }
  return {
    states,
    rows: [...grouped].map(([key, cells]) => {
      const [role, page, element] = JSON.parse(key) as [string, string, string];
      return { role, page, element, cells };
    }),
  };
}
