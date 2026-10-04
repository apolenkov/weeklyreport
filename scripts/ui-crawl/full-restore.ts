import { escapeState } from "./batch.ts";
import { findFullControl } from "./full-plan.ts";
import {
  awaitFullProbe,
  type FullControl,
  type FullProbe,
  readFullProbe,
} from "./full-probe.ts";
import type { Ctx } from "./logs.ts";
import { runBatch, settle } from "./press.ts";
import type { StepRecord } from "./types.ts";

type ReplayAction = Readonly<{
  control: FullControl;
  expected: string;
}>;

export type FullFrame = Readonly<{
  probe: FullProbe;
  path: readonly ReplayAction[];
  depth: number;
  /** Keys of controls an ancestor state already covered: a child plans only what is new. */
  known: ReadonlySet<string>;
}>;

export type FullHome = Readonly<{ key: string; url: string; probe: FullProbe }>;

export function invokeFullControl(
  ctx: Ctx,
  home: FullHome,
  control: FullControl,
) {
  return runBatch(ctx, { key: home.key, url: home.url, shotBase: "" }, [
    control,
  ]);
}

function invokeChecked(ctx: Ctx, home: FullHome, control: FullControl): void {
  const { outcome, hungReason } = invokeFullControl(ctx, home, control);
  const result = outcome.results[0];
  if (hungReason || result?.status !== "ok")
    throw new Error(
      `Restore failed for ${control.name}: ${hungReason ?? result?.status ?? "no result"}`,
    );
}

/** The press that puts a control back to its first-visit selection, or null when it already matches. */
function selectionRestore(
  previous: FullControl,
  live: FullControl,
): FullControl | null {
  if (previous.tag === "select")
    return previous.value === live.value
      ? null
      : { ...live, alternatives: [previous.value] };
  const choice = previous.role === "radio" || previous.role === "tab";
  const differs = choice
    ? previous.selected && !live.selected
    : previous.selected !== live.selected;
  return differs ? live : null;
}

/** A reload can keep a view choice (tab, filter, switch) in local storage: the original selection comes back first. */
function restoreSelections(ctx: Ctx, home: FullHome): void {
  let probe = readFullProbe(ctx.browser);
  for (const previous of home.probe.controls) {
    const live = findFullControl(probe, previous.elementId);
    const press = live ? selectionRestore(previous, live) : null;
    if (!press) continue;
    invokeChecked(ctx, home, press);
    probe = readFullProbe(ctx.browser);
  }
}

const stateOf = (control: FullControl): string =>
  JSON.stringify([
    control.selected,
    control.expanded,
    control.value,
    control.disabled,
  ]);

/** First observable difference between two probes, for a restore failure message. */
function describeDiff(expected: FullProbe, actual: FullProbe): string {
  if (expected.url !== actual.url)
    return `url ${expected.url} -> ${actual.url}`;
  if (expected.surface !== actual.surface)
    return `surface ${String(expected.surface)} -> ${String(actual.surface)}`;
  const before = new Map(
    expected.controls.map((c) => [c.elementId, c] as const),
  );
  const after = new Map(actual.controls.map((c) => [c.elementId, c] as const));
  for (const [id, control] of before) {
    const now = after.get(id);
    if (!now) return `missing ${id}`;
    if (stateOf(control) !== stateOf(now))
      return `${id}: ${stateOf(control)} -> ${stateOf(now)}`;
  }
  for (const id of after.keys()) if (!before.has(id)) return `new ${id}`;
  return "signature differs";
}

function replayFrame(ctx: Ctx, home: FullHome, frame: FullFrame): void {
  settle(ctx, home.url);
  restoreSelections(ctx, home);
  const reloaded = awaitFullProbe(ctx.browser, home.probe.signature);
  if (reloaded.signature !== home.probe.signature)
    throw new Error(
      `Restore failed: page baseline changed after reload (${describeDiff(home.probe, reloaded)})`,
    );
  for (const action of frame.path) {
    const live = findFullControl(
      readFullProbe(ctx.browser),
      action.control.elementId,
    );
    if (!live)
      throw new Error(`Restore failed: ${action.control.name} vanished`);
    invokeChecked(ctx, home, {
      ...live,
      alternatives: action.control.alternatives,
    });
    if (
      awaitFullProbe(ctx.browser, action.expected).signature !== action.expected
    )
      throw new Error(
        `Restore failed: unexpected state after ${action.control.name}`,
      );
  }
}

function restoreViewSelection(
  ctx: Ctx,
  home: FullHome,
  previous: FullControl,
): boolean {
  const probe = readFullProbe(ctx.browser);
  const live = findFullControl(probe, previous.elementId);
  if (previous.tag === "select" && live) {
    invokeChecked(ctx, home, { ...live, alternatives: [previous.value] });
    return true;
  }
  const selected = home.probe.controls.find(
    (control) =>
      control.selected &&
      control.group === previous.group &&
      control.role === "tab",
  );
  const tab = selected ? findFullControl(probe, selected.elementId) : undefined;
  if (tab) invokeChecked(ctx, home, tab);
  return !!tab;
}

/** Short wait for a fast dismissal (an exit animation); a slow path falls through to the next, surer one. */
const DISMISS_WAIT_MS = 400;

function returnedWithin(ctx: Ctx, frame: FullFrame, ms: number): boolean {
  return (
    awaitFullProbe(ctx.browser, frame.probe.signature, ms).signature ===
    frame.probe.signature
  );
}

/** Fast dismissal is accepted only when its observable state equals the recorded parent. */
export function restoreFullFrame(
  ctx: Ctx,
  home: FullHome,
  frame: FullFrame,
  control: FullControl,
): StepRecord["restoredBy"] {
  if (readFullProbe(ctx.browser).signature === frame.probe.signature)
    return "none";
  escapeState(ctx.browser);
  if (returnedWithin(ctx, frame, DISMISS_WAIT_MS)) return "escape";
  if (
    restoreViewSelection(ctx, { ...home, probe: frame.probe }, control) &&
    returnedWithin(ctx, frame, DISMISS_WAIT_MS)
  )
    return "toggle";
  replayFrame(ctx, home, frame);
  const replayed = awaitFullProbe(ctx.browser, frame.probe.signature);
  if (replayed.signature !== frame.probe.signature)
    throw new Error(
      `Restore failed: parent state was not recovered (${describeDiff(frame.probe, replayed)})`,
    );
  return "reload";
}
