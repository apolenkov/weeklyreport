import type { BatchOutcome, PressResult } from "./batch.ts";
import { REPEAT_LIMIT, SHOT_INDEX_WIDTH } from "./constants.ts";
import type { Ctx } from "./logs.ts";
import { skipReason } from "./policy.ts";
import {
  finishPress,
  hung,
  recoveredPress,
  runBatch,
  skipped,
  type Target,
} from "./press.ts";
import type { PageProbe, ProbedControl } from "./probe.ts";
import type { StepRecord } from "./types.ts";

export type PageRef = Readonly<{ key: string; url: string; tag: string }>;

export const identity = (c: ProbedControl): string =>
  `${c.tag}|${c.role ?? ""}|${c.name}`;

/** Row-repeated controls ("Inspect health for X") share a family: only the first few are pressed. */
export function controlFamily(control: ProbedControl): string {
  const [first = "", ...rest] = control.name.split(" ");
  // plain lowercase words are the label; names, codes and numbers are row data
  const shape = [first, ...rest.map((w) => (/^[a-z()]+$/.test(w) ? w : "*"))]
    .join(" ")
    .replaceAll(/(\* )+/g, "* ");
  return `${control.tag}|${control.role ?? ""}|${shape}`;
}

export interface Counters {
  pressed: number;
  families: Map<string, number>;
}

/** What a planning round works from: the first probe, the controls found again now, and the tallies so far. */
export type Plan = Readonly<{
  probe: PageProbe;
  live: ReadonlyMap<string, ProbedControl>;
  counters: Counters;
}>;

type Entry = Readonly<{
  index: number;
  control: ProbedControl;
  reason: string | null;
  live: ProbedControl | null;
}>;

/** Decides, without pressing, what happens to every control from `from` on (counters are a copy). */
export function planEntries(
  ctx: Ctx,
  plan: Plan,
  from: number,
): readonly Entry[] {
  const families = new Map(plan.counters.families);
  let { pressed } = plan.counters;
  return plan.probe.controls.slice(from).map((control, offset) => {
    const family = controlFamily(control);
    const repeated = families.get(family) === REPEAT_LIMIT;
    const capped = pressed >= ctx.config.maxControls;
    const target = plan.live.get(identity(control)) ?? null;
    const reason =
      skipReason(control) ??
      (repeated
        ? `repeat: ${REPEAT_LIMIT} similar controls already pressed`
        : null) ??
      (capped
        ? `cap: more than ${ctx.config.maxControls} controls per page`
        : null) ??
      (target ? null : "gone: an earlier press changed the view");
    if (!reason) {
      pressed += 1;
      families.set(family, (families.get(family) ?? 0) + 1);
    }
    return { index: from + offset, control, reason, live: target };
  });
}

type Round = Readonly<{
  steps: readonly StepRecord[];
  /** Recovery failed; the owner must stop without querying the unknown page again. */
  aborted?: boolean;
  /** Index to plan next, or null when the page is finished. */
  next: number | null;
}>;

function pressTargets(
  ctx: Ctx,
  page: PageRef,
  entries: readonly Entry[],
): ReturnType<typeof runBatch> {
  const targets = entries.flatMap((e) => (e.live && !e.reason ? [e.live] : []));
  if (targets.length === 0)
    return {
      outcome: { results: [], stopped: false, req: 0, took: 0 },
      hungReason: null,
      restored: true,
    };
  return runBatch(ctx, { key: page.key, url: page.url, shotBase: "" }, targets);
}

const GONE = "gone: an earlier press changed the view";

/** Records one finished press; `stop` is set when the page was left changed and must be probed again. */
function pressOne(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  result: PressResult,
): Readonly<{ step: StepRecord; stop: boolean }> {
  if (result.status === "gone")
    return { step: skipped(control, GONE), stop: false };
  console.error(
    `[${ctx.role.name}@${ctx.width}] ${target.key} :: ${control.name}`,
  );
  return {
    step: finishPress(ctx, target, control, result),
    stop: result.after !== result.before || result.urlChanged,
  };
}

function countPress(counters: Counters, control: ProbedControl): void {
  counters.pressed += 1;
  const family = controlFamily(control);
  counters.families.set(family, (counters.families.get(family) ?? 0) + 1);
}

/** The batch ended before this control: it was never reached, or the browser hung on it. */
function cutShort(
  ctx: Ctx,
  at: Readonly<{
    steps: StepRecord[];
    target: Target;
    control: ProbedControl;
    index: number;
  }>,
  hungReason: string | null,
): Round {
  if (hungReason === null) return { steps: at.steps, next: at.index };
  at.steps.push(hung(ctx, at.target, at.control, hungReason));
  return { steps: at.steps, next: at.index + 1 };
}

function recoveredRound(
  ctx: Ctx,
  page: PageRef,
  entries: readonly Entry[],
  recovery: Readonly<{
    outcome: BatchOutcome;
    hungReason: string | null;
    counters: Counters;
  }>,
): Round {
  const steps: StepRecord[] = [];
  let used = 0;
  for (const { control, reason, live } of entries) {
    if (reason || !live) {
      steps.push(skipped(control, reason ?? "gone"));
      continue;
    }
    const target = { key: page.key, url: page.url, shotBase: "" };
    const result = recovery.outcome.results[used++];
    if (!result) {
      steps.push(
        hung(ctx, target, control, recovery.hungReason ?? "recovery failed"),
      );
      break;
    }
    if (result.status === "gone") steps.push(skipped(control, GONE));
    else {
      steps.push(recoveredPress(ctx, target, control, result));
      countPress(recovery.counters, control);
    }
  }
  return { steps, next: null, aborted: true };
}

/** Presses the planned controls in one browser call; returns the steps and the next index to plan. */
export function pressEntries(
  ctx: Ctx,
  page: PageRef,
  entries: readonly Entry[],
  counters: Counters,
): Round {
  const { outcome, hungReason, restored } = pressTargets(ctx, page, entries);
  if (!restored)
    return recoveredRound(ctx, page, entries, {
      outcome,
      hungReason,
      counters,
    });
  const steps: StepRecord[] = [];
  let used = 0;
  for (const { control, index, reason, live } of entries) {
    if (reason || !live) {
      steps.push(skipped(control, reason ?? "gone"));
      continue;
    }
    const target = {
      key: page.key,
      url: page.url,
      shotBase: `${page.tag}-c${String(index).padStart(SHOT_INDEX_WIDTH, "0")}`,
    };
    const result = outcome.results[used];
    used += 1;
    if (!result)
      return cutShort(ctx, { steps, target, control, index }, hungReason);
    const { step, stop } = pressOne(ctx, target, control, result);
    if (result.status !== "gone") countPress(counters, control);
    steps.push(step);
    if (stop) return { steps, next: index + 1 };
  }
  return { steps, next: null };
}
