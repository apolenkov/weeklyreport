import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PressLog, PressResult } from "./batch.ts";
import { SLOW_MS } from "./constants.ts";
import type { FullControl, FullProbe } from "./full-probe.ts";
import { add, type Ctx } from "./logs.ts";
import { axeProbe } from "./probe.ts";
import type { StepRecord } from "./types.ts";

export type StateEvidence = Readonly<{
  id: string;
  depth: number;
  path: readonly string[];
  controlsFound: number;
  shot: string;
  dom: string;
  signature: string;
  status: "observed" | "depth-limit";
}>;

export type EvidencePlace = Readonly<{
  key: string;
  tag: string;
  depth: number;
  path: readonly string[];
}>;

type AxeViolation = Readonly<{
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
  sample: string;
}>;

export function fullShot(ctx: Ctx, base: string): string {
  const shot = `${base}.png`;
  const [result] = ctx.browser.batch([
    ["screenshot", "--full", join(ctx.dir, shot)],
  ]);
  if (!result?.ok)
    throw new Error(`Screenshot failed: ${result?.error ?? "no result"}`);
  return shot;
}

export function stateEvidence(
  ctx: Ctx,
  place: EvidencePlace,
  probe: FullProbe,
): StateEvidence {
  const shot = fullShot(ctx, place.tag);
  const dom = `${place.tag}.json`;
  writeFileSync(join(ctx.dir, dom), JSON.stringify(probe, null, 2));
  return {
    id: place.tag,
    depth: place.depth,
    path: place.path,
    controlsFound: probe.controls.length,
    shot,
    dom,
    signature: probe.signature,
    status: place.depth >= ctx.config.maxDepth ? "depth-limit" : "observed",
  };
}

export function auditFullState(
  ctx: Ctx,
  place: Readonly<{ key: string; shot: string }>,
  probe: FullProbe,
  axeSource: string,
): Readonly<{ axeViolations: number; geometryIssues: number }> {
  const violations = ctx.browser.evaluate(
    axeProbe(axeSource),
  ) as readonly AxeViolation[];
  const location = { page: place.key, shot: place.shot };
  for (const violation of violations)
    add(ctx, location, {
      severity: ["critical", "serious"].includes(violation.impact ?? "")
        ? "medium"
        : "low",
      kind: `axe-${violation.id}`,
      detail: `${violation.help} (${violation.nodes} nodes, ${violation.sample})`,
    });
  const visibleNames = new Set(
    probe.controls
      .filter((c) => c.surface === probe.surface)
      .map((c) => c.name),
  );
  const geometry = probe.surface
    ? probe.geometry.filter((issue) => visibleNames.has(issue.target))
    : probe.geometry;
  for (const issue of geometry)
    add(ctx, location, {
      severity: issue.kind.startsWith("target-under") ? "low" : "medium",
      kind: issue.kind,
      detail: `${issue.target}: ${issue.detail}`,
    });
  return { axeViolations: violations.length, geometryIssues: geometry.length };
}

function logFindings(
  ctx: Ctx,
  place: Readonly<{ key: string; shot: string }>,
  logs: readonly PressLog[],
): void {
  for (const log of logs) {
    if (log.kind === "network") continue;
    add(
      ctx,
      { page: place.key, shot: place.shot },
      {
        severity: log.kind === "page-error" ? "high" : "medium",
        kind: log.kind,
        detail: log.detail,
      },
    );
  }
}

export function fullStep(
  ctx: Ctx,
  place: EvidencePlace,
  control: FullControl,
  result: Readonly<{
    press?: PressResult;
    reason?: string;
    shot: string;
    error?: boolean;
  }>,
): StepRecord {
  const press = result.press;
  const reason = result.reason ?? null;
  logFindings(ctx, { key: place.key, shot: result.shot }, press?.logs ?? []);
  if (press && press.ms > SLOW_MS)
    add(
      ctx,
      { page: place.key, shot: result.shot },
      {
        severity: "low",
        kind: "slow-response",
        detail: `${control.name}: ${press.ms} ms`,
      },
    );
  return {
    name: control.name,
    tag: control.tag,
    elementId: control.elementId,
    state: ctx.config.state,
    depth: place.depth,
    path: [...place.path, control.name],
    action: result.error ? "error" : reason ? "skipped" : "pressed",
    reason,
    urlChanged: press?.urlChanged ?? false,
    stateChanged: press ? press.before !== press.after : false,
    restoredBy: "none",
    responseMs: press?.ms ?? null,
    shot: result.shot,
    logs: press?.logs ?? [],
  };
}
