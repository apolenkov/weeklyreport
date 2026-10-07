import type { PressResult } from "./batch.ts";
import {
  auditFullState,
  type EvidencePlace,
  fullShot,
  fullStep,
  type StateEvidence,
  stateEvidence,
} from "./full-evidence.ts";
import { controlKey } from "./full-plan.ts";
import {
  type FullControl,
  type FullProbe,
  readFullProbe,
} from "./full-probe.ts";
import {
  type FullFrame,
  type FullHome,
  invokeFullControl,
  restoreFullFrame,
} from "./full-restore.ts";
import { add, type Ctx } from "./logs.ts";
import { settle } from "./press.ts";
import { isSyntheticMutation } from "./synthetic.ts";
import type { PageRecord, StepRecord } from "./types.ts";

type PairwiseEvidence = NonNullable<PageRecord["pairwise"]>[number];

export interface FullSession {
  readonly ctx: Ctx;
  home: FullHome;
  readonly axeSource: string;
  readonly tag: string;
  readonly steps: StepRecord[];
  readonly states: StateEvidence[];
  readonly pairs: PairwiseEvidence[];
  readonly links: Set<string>;
  readonly visited: Set<string>;
  readonly representatives: Map<string, string>;
  /** Controls already pressed or recorded: a later walk of the same page does not repeat them. */
  readonly done: Set<string>;
  /** The last probe of a page that no press has changed since: the next control is looked up in it. */
  probeCache: FullProbe | null;
  presses: number;
  limited: boolean;
  aborted: boolean;
  mutated: boolean;
  axeViolations: number;
  geometryIssues: number;
}

function framePlace(session: FullSession, frame: FullFrame): EvidencePlace {
  return {
    key: session.home.key,
    tag: `${session.tag}-s${session.states.length}`,
    depth: frame.depth,
    path: frame.path.map((action) => action.control.name),
  };
}

/** A failed recovery or observed write invalidates dependent work on the current baseline. */
export function cannotContinue(session: FullSession): boolean {
  return session.aborted || session.mutated;
}

/** The page shows `frame` now: photograph it and audit it with a geometry probe. */
export function captureState(
  session: FullSession,
  frame: FullFrame,
): StateEvidence {
  const probe = readFullProbe(session.ctx.browser, true);
  const evidence = stateEvidence(
    session.ctx,
    framePlace(session, frame),
    probe,
  );
  const audit = auditFullState(
    session.ctx,
    { key: session.home.key, shot: evidence.shot },
    probe,
    session.axeSource,
  );
  session.states.push(evidence);
  session.axeViolations += audit.axeViolations;
  session.geometryIssues += audit.geometryIssues;
  for (const link of probe.links) session.links.add(link);
  return evidence;
}

/**
 * Returns the page to `frame`. A restoration that fails (content that changes on its own, a lost session) is
 * recorded and the page is rebased like after a write, so one stuck branch does not discard the rest of the page.
 */
export function restoreOrRebase(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
): StepRecord["restoredBy"] | null {
  try {
    return restoreFullFrame(session.ctx, session.home, frame, control);
  } catch (error: unknown) {
    add(
      session.ctx,
      { page: session.home.key, shot: session.states.at(-1)?.shot ?? null },
      {
        severity: "medium",
        kind: "crawl-restore-failed",
        detail: error instanceof Error ? error.message : "restore failed",
      },
    );
    session.mutated = true;
    session.limited = true;
    return null;
  }
}

/** After a write the page is reloaded and its new content becomes the baseline of a fresh walk; finished controls are not repeated. */
export function rebaseAfterWrite(session: FullSession): FullProbe {
  settle(session.ctx, session.home.url, "rebase");
  const probe = readFullProbe(session.ctx.browser);
  session.home = { ...session.home, probe };
  session.mutated = false;
  session.probeCache = null;
  session.visited.clear();
  return probe;
}

export function recordSkip(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
  reason: string,
): void {
  if (!reason.startsWith("baseline-mutated"))
    session.done.add(controlKey(control));
  session.steps.push(
    fullStep(session.ctx, framePlace(session, frame), control, {
      reason,
      shot: session.states.at(-1)?.shot ?? "",
    }),
  );
}

/** A press that was made: `unchanged` says it left the page exactly as it was. */
type Effect = Readonly<{
  press: PressResult;
  index: number;
  unchanged: boolean;
}>;

function noteMutation(session: FullSession, press: PressResult): void {
  if (!isSyntheticMutation(press.logs)) return;
  session.mutated = true;
  add(
    session.ctx,
    { page: session.home.key, shot: session.steps.at(-1)?.shot ?? null },
    {
      severity: "medium",
      kind: "crawl-baseline-mutated",
      detail:
        "A write request was observed on the synthetic database. The new state was captured and the page walk restarts from the written baseline; the write is never replayed.",
    },
  );
}

function noteObstructed(session: FullSession, control: FullControl): void {
  add(
    session.ctx,
    { page: session.home.key, shot: session.states.at(-1)?.shot ?? null },
    {
      severity: "low",
      kind: "click-failed",
      detail: `${control.name}: covered by another element`,
    },
  );
}

/** Why a press produced no usable effect, or null when it did. */
function failure(
  press: PressResult | undefined,
  hungReason: string | null,
): string | null {
  if (hungReason) return hungReason;
  return press?.status === "ok" ? null : (press?.status ?? "no result");
}

/** A select can change a value that neither the text nor a checked flag shows, so it always counts as changed. */
function leftAsItWas(control: FullControl, press: PressResult): boolean {
  return (
    control.tag !== "select" &&
    press.before === press.after &&
    !press.urlChanged
  );
}

/** Each attempted action keeps its own screenshot and request/console evidence. */
export function executeControl(
  session: FullSession,
  frame: FullFrame,
  control: FullControl,
): Effect | null {
  session.presses += 1;
  const { outcome, hungReason, restored } = invokeFullControl(
    session.ctx,
    session.home,
    control,
  );
  const press = outcome.results[0];
  const changed = press !== undefined && press.before !== press.after;
  session.aborted = !restored;
  const shot = !restored
    ? null
    : changed
      ? fullShot(session.ctx, `${session.tag}-a${session.steps.length}`)
      : (session.states.at(-1)?.shot ?? "");
  session.done.add(controlKey(control));
  const reason = failure(press, hungReason);
  if (press?.status === "obstructed") noteObstructed(session, control);
  const index = session.steps.length;
  session.steps.push(
    fullStep(session.ctx, framePlace(session, frame), control, {
      ...(press ? { press } : {}),
      shot,
      ...(reason
        ? { reason, error: reason !== "gone" && reason !== "obstructed" }
        : {}),
    }),
  );
  if (press) noteMutation(session, press);
  if (reason || !press) return null;
  return { press, index, unchanged: leftAsItWas(control, press) };
}

/** The page after an effect: its controls are the next frame's plan, its links feed the page queue. */
export function observeEffect(
  session: FullSession,
  frame: FullFrame,
): FullProbe {
  const probe = readFullProbe(session.ctx.browser);
  for (const link of probe.links) session.links.add(link);
  if (probe.url !== frame.probe.url) session.links.add(probe.url);
  return probe;
}
