import { join } from "node:path";

import { ESCAPE_WAIT_MS, SETTLE_MS, SLOW_MS } from "./constants.ts";
import type { Step } from "./driver.ts";
import { add, type Ctx, DRAIN_COMMANDS, reportLogs } from "./logs.ts";
import {
  PRESS_BEGIN,
  PRESS_END,
  type ProbedControl,
  SIGNATURE_ONLY,
} from "./probe.ts";
import type { StepRecord } from "./types.ts";

export type Target = Readonly<{ key: string; url: string; shotBase: string }>;

const NO_EFFECT = {
  urlChanged: false,
  stateChanged: false,
  restoredBy: "none",
  responseMs: null,
  shot: null,
} as const;

/** Another process (or a timed-out CLI call) can restart the browser: that drops the cookie session. */
function signedOut(ctx: Ctx, url: string): boolean {
  const path = String(ctx.browser.evaluate("location.pathname"));
  return path === "/" && new URL(url).pathname !== "/";
}

/** Reload the page or reopen its URL, signing in again if the browser lost its session. */
export function settle(ctx: Ctx, url: string | null): number {
  const start = performance.now();
  const load = [
    url ? ["open", url] : ["reload"],
    ["wait", "--load", "networkidle"],
    ["wait", String(SETTLE_MS)],
  ];
  ctx.browser.batch(load);
  const target = url ?? String(ctx.browser.evaluate("location.href"));
  if (signedOut(ctx, target)) {
    ctx.signIn();
    ctx.browser.batch([["open", target], ...load.slice(1)]);
  }
  return Math.round(performance.now() - start);
}

type Outcome = Readonly<{
  before: string;
  after: string;
  escaped: string;
  responseMs: number | null;
}>;

function restore(
  ctx: Ctx,
  target: Target,
  outcome: Outcome,
): StepRecord["restoredBy"] {
  const urlChanged =
    outcome.after.split("|")[0] !== outcome.before.split("|")[0];
  if (urlChanged) {
    settle(ctx, target.url);
    return "navigate";
  }
  if (outcome.after === outcome.before) return "none";
  if (outcome.escaped === outcome.before) return "escape";
  settle(ctx, null);
  return "reload";
}

/** One batch: press, wait, capture screenshot and logs, try Escape. Then undo if the state moved. */
export function pressControl(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
): StepRecord {
  const shot = `${target.shotBase}.png`;
  console.error(
    `[${ctx.role.name}@${ctx.width}] ${target.key} :: ${control.name}`,
  );
  const outcome = pressBatch(ctx, control, shot);
  if ("error" in outcome) return hung(ctx, target, control, outcome.error);
  return finishPress(ctx, target, control, { steps: outcome.steps, shot });
}

/** A press that never returns (native dialog, stuck navigation): dismiss, reopen the page, move on. */
function hung(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  cause: string,
): StepRecord {
  const reason = cause.split("\n")[0] ?? cause;
  add(
    ctx,
    { page: target.key, shot: null },
    {
      severity: "medium",
      kind: "press-hung",
      detail: `${control.name}: ${reason}`,
    },
  );
  try {
    ctx.browser.batch([["dialog", "dismiss"]]);
  } catch {
    // no dialog was open
  }
  settle(ctx, target.url);
  return {
    name: control.name,
    tag: control.tag,
    ...NO_EFFECT,
    action: "error",
    reason,
  };
}

/** A native select opens an OS popup that headless Chrome cannot close: choose another option instead. */
function pressCommand(control: ProbedControl): readonly string[] {
  const [alternative] = control.alternatives;
  return control.tag === "select" && alternative !== undefined
    ? ["select", control.selector, alternative]
    : ["click", control.selector];
}

function pressBatch(
  ctx: Ctx,
  control: ProbedControl,
  shot: string,
): Readonly<{ steps: readonly Step[] }> | Readonly<{ error: string }> {
  try {
    const steps = ctx.browser.batch([
      ["eval", PRESS_BEGIN],
      pressCommand(control),
      ["wait", String(SETTLE_MS)],
      ["eval", PRESS_END],
      ["screenshot", join(ctx.dir, shot)],
      ...DRAIN_COMMANDS,
      ["press", "Escape"],
      ["wait", String(ESCAPE_WAIT_MS)],
      ["eval", SIGNATURE_ONLY],
    ]);
    return { steps };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "press failed" };
  }
}

function finishPress(
  ctx: Ctx,
  target: Target,
  control: ProbedControl,
  { steps, shot }: Readonly<{ steps: readonly Step[]; shot: string }>,
): StepRecord {
  const [begin, click, , end, , console_, network, errors, , , , , , escaped] =
    steps;
  const base = { name: control.name, tag: control.tag };
  if (!click?.ok) {
    const reason = click?.error ?? "click failed";
    add(
      ctx,
      { page: target.key, shot: null },
      {
        severity: "low",
        kind: "click-failed",
        detail: `${control.name}: ${reason}`,
      },
    );
    settle(ctx, null);
    return { ...base, ...NO_EFFECT, action: "error", reason };
  }
  const place = { page: target.key, shot };
  reportLogs(ctx, place, {
    console: console_?.value,
    network: network?.value,
    errors: errors?.value,
  });
  const result = end?.value as { sig: string; ms: number | null } | undefined;
  const outcome: Outcome = {
    before: String(begin?.value),
    after: result?.sig ?? "",
    escaped: String(escaped?.value),
    responseMs: result?.ms ?? null,
  };
  if (outcome.responseMs !== null && outcome.responseMs > SLOW_MS) {
    add(ctx, place, {
      severity: "low",
      kind: "slow-response",
      detail: `${control.name}: ${outcome.responseMs} ms`,
    });
  }
  const restoredBy = restore(ctx, target, outcome);
  return {
    ...base,
    action: "pressed",
    reason: null,
    urlChanged: restoredBy === "navigate",
    stateChanged: outcome.after !== outcome.before,
    restoredBy,
    responseMs: outcome.responseMs,
    shot,
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
