import { text } from "./logs.ts";
import type { RunDir } from "./run-dir.ts";

/** One call of the synthetic API scenario (written by scripts/ui-crawl/scenario.ts). */
export interface ScenarioCall {
  step: string;
  role: string;
  path: string;
  ok: boolean;
  status: number;
  code: string;
}

const FILE = "scenarios/scenarios.json";

function calls(run: RunDir): ScenarioCall[] {
  return run.exists(FILE)
    ? (JSON.parse(run.read(FILE)) as { calls: ScenarioCall[] }).calls
    : [];
}

/** Successful scenario calls per procedure. */
export function scenarioOk(run: RunDir): Map<string, number> {
  const ok = new Map<string, number>();
  for (const call of calls(run))
    if (call.ok) ok.set(call.path, (ok.get(call.path) ?? 0) + 1);
  return ok;
}

function outcome(call: ScenarioCall): string {
  if (call.ok) return "ok";
  return `${String(call.status)} ${text(call.code)}`;
}

/** Section of report.md for the synthetic API scenario. */
export function scenarioSection(run: RunDir): string[] {
  const all = calls(run);
  if (all.length === 0)
    return ["", "## 9a. Synthetic API scenario", "", "_not run_"];
  const failed = all.filter((c) => !c.ok);
  return [
    "",
    "## 9a. Synthetic API scenario",
    "",
    "Evidence: `scenarios/` (scenarios.json, scenario.log). The calls are made as the signed-in role through the page's own `fetch` against `/trpc`, in the order that keeps each later step valid, on a freshly reset stand. They exercise handlers the crawler skips as dangerous; they are API-level calls, not clicks.",
    "",
    `Calls: **${String(all.length)}**, succeeded: **${String(all.length - failed.length)}**, expected or unexpected failures: **${String(failed.length)}**.`,
    "",
    "| step | role | procedure | result |",
    "|---|---|---|---|",
    ...all.map((c) => `| ${c.step} | ${c.role} | ${c.path} | ${outcome(c)} |`),
  ];
}
