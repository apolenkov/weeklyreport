import { waitForSelector } from "./batch.ts";
import { exploreCombinations } from "./full-combinations.ts";
import type { StateEvidence } from "./full-evidence.ts";
import { filterPlan } from "./full-filters.ts";
import {
  childKnown,
  controlKey,
  familySkipReason,
  findFullControl,
  fullControlReason,
  fullUrl,
  rowSkipReason,
  stateControls,
} from "./full-plan.ts";
import { type FullControl, readFullProbe } from "./full-probe.ts";
import type { FullFrame } from "./full-restore.ts";
import {
  captureState,
  executeControl,
  type FullSession,
  recordSkip,
  restoreOrRebase,
} from "./full-session.ts";
import { syntheticSkipReason } from "./synthetic.ts";

function policyReason(
  session: FullSession,
  control: FullControl,
): string | null {
  return (
    syntheticSkipReason(control, session.ctx) ??
    fullControlReason(control) ??
    rowSkipReason(control, session.representatives) ??
    familySkipReason(control, session.representatives)
  );
}

function limitReason(session: FullSession, frame: FullFrame): string | null {
  if (session.mutated) return "baseline-mutated: a write is being rebased";
  if (frame.depth >= session.ctx.config.maxDepth)
    return `depth-limit: ${session.ctx.config.maxDepth}`;
  if (session.presses >= session.ctx.config.maxControls)
    return `control-limit: ${session.ctx.config.maxControls}`;
  return null;
}

function dangerOrder(control: FullControl): number {
  return Number(
    control.type === "submit" ||
      /\b(submit|publish|reopen|approve|request changes|confirm|save)\b/i.test(
        control.name,
      ),
  );
}

function visitEffect(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
): void {
  const effect = executeControl(session, frame, control);
  if (!effect) {
    session.limited = true;
    if (!session.mutated) restoreOrRebase(session, frame, control);
    return;
  }
  const child = {
    probe: effect.probe,
    path: [...frame.path, { control, expected: effect.probe.signature }],
    depth: frame.depth + 1,
    known: childKnown(frame),
  };
  if (session.mutated) captureState(session, child);
  else if (fullUrl(effect.probe.url) === fullUrl(frame.probe.url))
    walkFrame(session, child);
  else captureState(session, child);
  if (session.mutated) return;
  const restoredBy = restoreOrRebase(session, frame, control);
  const recorded = session.steps[effect.index];
  if (recorded && restoredBy)
    session.steps[effect.index] = { ...recorded, restoredBy };
}

/** A control missing because the page is still coming back is waited for by DOM events before it counts as gone. */
function liveControl(
  session: FullSession,
  control: FullControl,
): FullControl | undefined {
  const { browser } = session.ctx;
  const found = findFullControl(readFullProbe(browser), control.elementId);
  if (found || !waitForSelector(browser, control.selector)) return found;
  return findFullControl(readFullProbe(browser), control.elementId);
}

/** Bound or pairwise reason to leave a policy-approved control alone. */
function skipReason(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
  finiteIds: ReadonlySet<string>,
): string | null {
  const limited = limitReason(session, frame);
  if (limited) {
    session.limited = true;
    return limited;
  }
  return finiteIds.has(control.elementId)
    ? "pairwise: finite combinations recorded separately"
    : null;
}

function cutShort(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
): void {
  session.limited = true;
  recordSkip(
    session,
    frame,
    control,
    "baseline-mutated: a write cut this branch short",
  );
}

function walkControl(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
  reason: string | null,
): void {
  const live = reason ? undefined : liveControl(session, control);
  if (live) visitEffect(session, frame, live);
  else if (reason) recordSkip(session, frame, control, reason);
  else {
    session.limited = true;
    recordSkip(session, frame, control, "gone: control vanished before action");
  }
}

function walkControls(
  session: FullSession,
  frame: FullFrame,
  reasons: ReadonlyMap<FullControl, string | null>,
  finiteIds: ReadonlySet<string>,
): void {
  for (const [control, policy] of reasons) {
    if (!session.mutated)
      walkControl(
        session,
        frame,
        control,
        policy ?? skipReason(session, frame, control, finiteIds),
      );
    // the root frame is walked again from the written baseline; deeper branches are cut and say so
    else if (frame.depth > 0) cutShort(session, frame, control);
  }
}

/** Explore the opened surface before returning to its parent; every bound is visible in evidence. */
export function walkFrame(
  session: FullSession,
  frame: FullFrame,
  combinations = true,
): StateEvidence | undefined {
  if (session.visited.has(frame.probe.signature))
    return session.states.find(
      (state) => state.signature === frame.probe.signature,
    );
  session.visited.add(frame.probe.signature);
  const evidence = captureState(session, frame);
  const controls = stateControls(frame.probe)
    .filter(
      (control) =>
        !frame.known.has(controlKey(control)) &&
        !session.done.has(controlKey(control)),
    )
    .sort((a, b) => dangerOrder(a) - dangerOrder(b));
  const reasons = new Map(
    controls.map(
      (control) => [control, policyReason(session, control)] as const,
    ),
  );
  const plan = filterPlan(
    controls.filter((control) => reasons.get(control) === null),
  );
  const canCombine = combinations && !limitReason(session, frame);
  if (canCombine)
    exploreCombinations(session, frame, plan, (next) =>
      walkFrame(session, next, false),
    );
  const finiteIds = new Set(
    canCombine
      ? plan.factors.flatMap((factor) =>
          factor.controls.map((control) => control.elementId),
        )
      : [],
  );
  walkControls(session, frame, reasons, finiteIds);
  return evidence;
}
