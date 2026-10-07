import type { StateEvidence } from "./full-evidence.ts";
import {
  factorTarget,
  factorValue,
  type FilterPlan,
  type FullFactor,
} from "./full-filters.ts";
import { childKnown } from "./full-plan.ts";
import { readFullProbe } from "./full-probe.ts";
import type { FullFrame } from "./full-restore.ts";
import {
  cannotContinue,
  executeControl,
  type FullSession,
  observeEffect,
  restoreOrRebase,
} from "./full-session.ts";

type Descend = (frame: FullFrame) => StateEvidence | undefined;

function unavailable(
  session: FullSession,
  values: Readonly<Record<string, string>>,
  reason: string,
): void {
  session.limited = true;
  session.pairs.push({ values, reason, status: "skipped", shot: null });
}

type Selection = Readonly<{ frame: FullFrame } | { reason: string }>;

function selectFactor(
  session: FullSession,
  current: FullFrame,
  factor: FullFactor,
  value: string,
): Selection {
  const probe = readFullProbe(session.ctx.browser);
  if (factorValue(probe, factor) === value) return { frame: current };
  if (session.presses >= session.ctx.config.maxControls)
    return { reason: "pairwise: control budget reached" };
  const control = factorTarget(probe, factor, value);
  if (!control)
    return { reason: `pairwise: value unavailable ${factor.id}=${value}` };
  if (!executeControl(session, current, control))
    return { reason: `pairwise: failed to select ${factor.id}=${value}` };
  const after = observeEffect(session, current);
  return {
    frame: {
      probe: after,
      path: [...current.path, { control, expected: after.signature }],
      depth: current.depth + 1,
      known: childKnown(current),
    },
  };
}

function selectCombination(
  session: FullSession,
  frame: FullFrame,
  plan: FilterPlan,
  values: Readonly<Record<string, string>>,
): Selection {
  let current = frame;
  for (const factor of plan.factors) {
    const value = values[factor.id];
    if (value === undefined)
      return { reason: `pairwise: no value for ${factor.id}` };
    const step = selectFactor(session, current, factor, value);
    if ("reason" in step) return step;
    current = step.frame;
    if (session.mutated)
      return { reason: "pairwise: write request changed the baseline" };
  }
  const probe = readFullProbe(session.ctx.browser);
  const mismatch = plan.factors.find(
    (factor) => factorValue(probe, factor) !== values[factor.id],
  );
  return mismatch
    ? { reason: `pairwise: resulting value differs for ${mismatch.id}` }
    : { frame: { ...current, probe } };
}

function restoreCombination(
  session: FullSession,
  frame: FullFrame,
  plan: FilterPlan,
): void {
  const trigger = plan.factors[0]?.controls[0];
  if (!trigger || session.mutated) return;
  restoreOrRebase(session, frame, trigger);
}

function observe(
  session: FullSession,
  values: Readonly<Record<string, string>>,
  frame: FullFrame,
  descend: Descend,
): void {
  const evidence = descend(frame);
  session.pairs.push({
    values,
    status: evidence ? "observed" : "error",
    reason: evidence ? null : "pairwise: resulting state has no evidence",
    shot: evidence?.shot ?? null,
  });
}

/** A generated row becomes observed only after every value is verified together in the DOM. */
export function exploreCombinations(
  session: FullSession,
  frame: FullFrame,
  plan: FilterPlan,
  descend: Descend,
): void {
  for (const values of plan.combinations) {
    if (session.aborted) break;
    const selected = session.mutated
      ? { reason: "pairwise: prior write changed the baseline" }
      : selectCombination(session, frame, plan, values);
    if ("reason" in selected) unavailable(session, values, selected.reason);
    else observe(session, values, selected.frame, descend);
    if (!cannotContinue(session)) restoreCombination(session, frame, plan);
  }
}
