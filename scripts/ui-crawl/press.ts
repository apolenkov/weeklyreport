import assert from "node:assert/strict";

import {
  type BatchOutcome,
  escapeState,
  pressBatch,
  type PressLog,
  type PressResult,
  quietState,
  repress,
  takeRequests,
} from "./batch.ts";
import { recoverBatch } from "./batch-recovery.ts";
import {
  BATCH_BUDGET_MS,
  BATCH_COST,
  MAX_QUIET_MS,
  PAGE_LOAD_COST,
  REPRESS_COST,
  SLOW_MS,
  STALL_MS,
} from "./constants.ts";
import { add, type Ctx, type Place } from "./logs.ts";
import type { ProbedControl } from "./probe.ts";
import { pace, settleRate } from "./rate.ts";
import { captureScreenshot } from "./screenshot.ts";
import type { StepRecord } from "./types.ts";

export type Target = Readonly<{ key: string; url: string; shotBase: string }>;

const NO_EFFECT = {
  urlChanged: false,
  stateChanged: false,
  restoredBy: "none",
  responseMs: null,
  shot: null,
} as const;

/** Reason kept in the finding when a hung press carries no textual cause. */
const EMPTY_CAUSE_REASON = "press failed without a message";

/** Another process (or a timed-out CLI call) can restart the browser: that drops the cookie session. */
function signedOut(ctx: Ctx, url: string): boolean {
  const path = String(ctx.browser.evaluate("location.pathname"));
  return path === "/" && new URL(url).pathname !== "/";
}

/** Reload the page or reopen its URL, signing in again if the browser lost its session. */
export function settle(
  ctx: Ctx,
  url: string | null,
  why: SettleReason,
): number {
  const started = performance.now();
  try {
    return load(ctx, url);
  } finally {
    // the speed profile tells which caller the reload time belongs to
    const key = `settle:${why}`;
    const entry = ctx.browser.profile.get(key) ?? { calls: 0, ms: 0 };
    ctx.browser.profile.set(key, {
      calls: entry.calls + 1,
      ms: entry.ms + performance.now() - started,
    });
  }
}

/** Why a page was reloaded or reopened: the speed profile groups the time by this. */
export type SettleReason =
  "visit" | "navigate" | "reload" | "hung" | "replay" | "rebase";

function loadCommands(
  ctx: Ctx,
  commands: readonly (readonly string[])[],
): void {
  const results = ctx.browser.batch(commands);
  assert.ok(
    results.length === commands.length && results.every((result) => result.ok),
    `Page load failed: ${results.find((result) => !result.ok)?.error ?? "missing result"}`,
  );
}

function load(ctx: Ctx, url: string | null): number {
  const reservedAt = pace("trpc", PAGE_LOAD_COST);
  const start = performance.now();
  const load = [
    url ? ["open", url] : ["reload"],
    ["wait", "--load", "networkidle"],
  ];
  loadCommands(ctx, load);
  const target = url ?? String(ctx.browser.evaluate("location.href"));
  if (signedOut(ctx, target)) {
    ctx.signIn();
    loadCommands(ctx, [["open", target], ...load.slice(1)]);
  }
  quietState(ctx.browser);
  const loadMs = Math.round(performance.now() - start);
  settleRate("trpc", reservedAt, PAGE_LOAD_COST, takeRequests(ctx.browser));
  return loadMs;
}

type Outcome = Readonly<{
  before: string;
  after: string;
  escaped: string;
}>;

function restore(
  ctx: Ctx,
  target: Target,
  outcome: Outcome,
  control: ProbedControl,
): StepRecord["restoredBy"] {
  const urlChanged =
    outcome.after.split("|")[0] !== outcome.before.split("|")[0];
  if (urlChanged) {
    settle(ctx, target.url, "navigate");
    return "navigate";
  }
  if (outcome.after === outcome.before) return "none";
  if (outcome.escaped === outcome.before) return "escape";
  // An expander or toggle: pressing it again is cheaper than reloading the page.
  const reservedAt = pace("trpc", REPRESS_COST);
  const again = repress(ctx.browser, control);
  settleRate("trpc", reservedAt, REPRESS_COST, takeRequests(ctx.browser));
  if (again === outcome.before) return "toggle";
  settle(ctx, null, "reload");
  return "reload";
}

const LOG_SEVERITY: Readonly<Record<string, "high" | "medium" | "low">> = {
  "console-warn": "low",
  "page-error": "high",
};

function reportLogs(
  ctx: Ctx,
  place: Place,
  logs: readonly PressLog[],
  name: string,
): void {
  for (const log of logs)
    if (log.kind !== "network")
      add(ctx, place, {
        severity: LOG_SEVERITY[log.kind] ?? "medium",
        kind: log.kind,
        detail: `${name}: ${log.detail}`,
      });
}

/** A press that never returns (native dialog, stuck navigation): dismiss, reopen the page, move on. */
export function hung(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  cause: string,
): StepRecord {
  // An empty first line must not erase the diagnostic: take the first non-blank line.
  const reason =
    cause.split("\n").find((line) => line.trim() !== "") ?? EMPTY_CAUSE_REASON;
  add(
    ctx,
    { page: target.key, shot: null },
    {
      severity: "medium",
      kind: "press-hung",
      detail: `${control.name}: ${reason}`,
    },
  );
  return {
    name: control.name,
    tag: control.tag,
    ...NO_EFFECT,
    action: "error",
    reason,
  };
}

/** Runs one batch; a failed browser call keeps the presses finished before it and flags the next one as hung. */
export function runBatch(
  ctx: Ctx,
  target: Target,
  controls: readonly ProbedControl[],
): Readonly<{
  outcome: BatchOutcome;
  hungReason: string | null;
  restored: boolean;
}> {
  const reservedAt = pace("trpc", BATCH_COST);
  try {
    const sent = performance.now();
    const outcome = pressBatch(ctx.browser, controls, {
      budgetMs: BATCH_BUDGET_MS,
      maxQuietMs: MAX_QUIET_MS,
      mode: ctx.config.mode,
    });
    if (outcome.error !== undefined) {
      for (const kind of ["press-batch-failed", "coverage-incomplete"])
        add(
          ctx,
          { page: target.key, shot: null },
          {
            severity: "medium",
            kind,
            detail: outcome.error,
          },
        );
      return { outcome, hungReason: outcome.error, restored: false };
    }
    if (outcome.req !== null)
      settleRate("trpc", reservedAt, BATCH_COST, outcome.req);
    const total = Math.round(performance.now() - sent);
    if (total > STALL_MS)
      console.error(
        `[${ctx.role.name}@${ctx.width}] slow batch: ${total} ms, in page ${outcome.took} ms, ${outcome.results.length} presses`,
      );
    return { outcome, hungReason: null, restored: true };
  } catch (error: unknown) {
    return recoverBatch(ctx, target, error, () => {
      settle(ctx, target.url, "hung");
    });
  }
}

/** Completed evidence retained after failed restoration; no new action is safe on the unknown page. */
export function recoveredPress(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  result: PressResult,
): StepRecord {
  reportLogs(ctx, { page: target.key, shot: null }, result.logs, control.name);
  return {
    name: control.name,
    tag: control.tag,
    ...NO_EFFECT,
    action: result.status === "ok" ? "pressed" : "error",
    reason: result.status === "ok" ? null : (result.reason ?? result.status),
    urlChanged: result.urlChanged,
    stateChanged: result.after !== result.before,
    responseMs: result.status === "ok" ? result.ms : null,
    logs: result.logs,
  };
}

/** Turns one finished press into a step; a visible change is photographed, then undone. */
export function finishPress(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  result: PressResult,
): StepRecord {
  const base = { name: control.name, tag: control.tag };
  if (result.status === "stale")
    return {
      ...base,
      ...NO_EFFECT,
      action: "error",
      reason: result.reason ?? "stale select",
    };
  if (result.status === "obstructed") {
    const reason = "covered by another element";
    add(
      ctx,
      { page: target.key, shot: null },
      {
        severity: "low",
        kind: "click-failed",
        detail: `${control.name}: ${reason}`,
      },
    );
    return { ...base, ...NO_EFFECT, action: "error", reason };
  }
  const changed = result.after !== result.before;
  const shot = changed
    ? captureScreenshot(ctx, {
        page: target.key,
        filename: `${target.shotBase}.png`,
      })
    : null;
  const place = { page: target.key, shot };
  reportLogs(ctx, place, result.logs, control.name);
  if (result.ms > SLOW_MS) {
    add(ctx, place, {
      severity: "low",
      kind: "slow-response",
      detail: `${control.name}: ${result.ms} ms`,
    });
  }
  let restoredBy: StepRecord["restoredBy"] = "none";
  if (changed) {
    const urlMoved = result.urlChanged;
    const escaped = urlMoved ? result.after : escapeState(ctx.browser);
    restoredBy = restore(
      ctx,
      target,
      { before: result.before, after: result.after, escaped },
      control,
    );
  }
  if (process.env.CRAWL_TRACE)
    console.error(`[${ctx.role.name}] ${control.name} -> ${restoredBy}`);
  return {
    ...base,
    action: "pressed",
    reason: null,
    urlChanged: restoredBy === "navigate",
    stateChanged: changed,
    restoredBy,
    responseMs: result.ms,
    shot,
    logs: result.logs,
  };
}

export function skipped(control: ProbedControl, reason: string): StepRecord {
  return {
    name: control.name,
    tag: control.tag,
    ...NO_EFFECT,
    action: "skipped",
    reason,
  };
}
