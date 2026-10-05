import { join } from "node:path";

import { text } from "./logs.ts";
import type { RunDir } from "./run-dir.ts";

const STUCK_LIMIT = 0.6;
const EVENT_TEXT_MAX = 120;

/** Request failures a prefetch cancels on every navigation; they say nothing about the page. */
const BENIGN_FAILURE = /net::ERR_ABORTED/;

interface JevStep {
  executed_action?: unknown;
  stuck?: unknown;
  goal_done?: unknown;
}

/**
 * Second-judge signals from one Jev run. Jev is an action model and returns no prose verdict, so
 * the signals are what it did: it navigated away, clicked, got stuck, or saw failing requests.
 * Every signal is a lead to check against the screenshot, never a verdict.
 */
export function jevSignals(raw: string, startPath: string): string[] {
  const doc = JSON.parse(raw) as Record<string, unknown>;
  const signals: string[] = [];
  const steps = Array.isArray(doc.steps) ? (doc.steps as JevStep[]) : [];
  const clicks = steps
    .map((s) => text(s.executed_action))
    .filter((a) => a.startsWith("click"));
  if (clicks.length > 0) signals.push(`clicked ${clicks.join(", ")}`);
  const finalUrl = text(doc.final_url);
  if (finalUrl && new URL(finalUrl).pathname !== startPath.split("?")[0])
    signals.push(`left the page for ${new URL(finalUrl).pathname}`);
  const stuck = Math.max(0, ...steps.map((s) => Number(s.stuck) || 0));
  if (stuck >= STUCK_LIMIT) signals.push(`stuck ${stuck.toFixed(2)}`);
  const events = Array.isArray(doc.console_events)
    ? (doc.console_events as Record<string, unknown>[])
    : [];
  const failures = events.filter(
    (e) => e.type !== "log" && !BENIGN_FAILURE.test(text(e.text)),
  );
  if (failures.length > 0)
    signals.push(
      `${String(failures.length)} console events, first: ${text(failures[0]?.text).slice(0, EVENT_TEXT_MAX)}`,
    );
  if (doc.degraded === true) signals.push("jev degraded");
  return signals;
}

/** Section of report.md for the human-like pass written by dogfood.sh. */
export function dogfoodSection(run: RunDir): string[] {
  if (!run.exists("dogfood/summary.tsv"))
    return ["", "## 10. Human-like pass", "", "_not run_"];
  const rows = run
    .read("dogfood/summary.tsv")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split("\t"));
  const lines = rows.map(
    ([role = "", page = "", verdict = "", detail = "", jev = "-"]) => {
      let signals = "no Jev run";
      if (jev !== "-")
        try {
          const found = jevSignals(run.read(join("dogfood", role, jev)), page);
          signals = found.length > 0 ? found.join("; ") : "none";
        } catch {
          signals = "Jev output unreadable";
        }
      return `| ${role} | \`${page}\` | ${verdict} | ${detail} | ${signals} |`;
    },
  );
  return [
    "",
    "## 10. Human-like pass",
    "",
    "Evidence: `dogfood/` (screenshot, snapshot, console and page errors per page; Jev JSON and screenshot). PASS rests on the snapshot and page errors; Jev signals are leads to check against the screenshot.",
    "",
    "| Role | Page | Verdict | Detail | Jev signals |",
    "| --- | --- | --- | --- | --- |",
    ...lines,
    ...(run.exists("dogfood/dogfood-notes.md")
      ? ["", run.read("dogfood/dogfood-notes.md").trim()]
      : []),
  ];
}
