import { join } from "node:path";

import {
  FAMILY_WORDS,
  REPEAT_LIMIT,
  SETTLE_MS,
  SHOT_INDEX_WIDTH,
  SLOW_LOAD_MS,
} from "./constants.ts";
import { add, type Ctx, drainLogs, type Place } from "./logs.ts";
import { pageKey, sameOrigin, skipReason } from "./policy.ts";
import { pressControl, settle, skipped } from "./press.ts";
import {
  axeProbe,
  PAGE_PROBE,
  type PageProbe,
  type ProbedControl,
  SIGNATURE_ONLY,
} from "./probe.ts";
import type { PageRecord, StepRecord } from "./types.ts";

type AxeViolation = Readonly<{
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
  sample: string;
}>;

const INTERNAL = /\/(api|auth|monitoring|print)\b|logout|sign-?out/i;

function slug(key: string): string {
  return key.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "") || "root";
}

/** Row-repeated controls ("Inspect health for X") share a family: only the first few are pressed. */
function controlFamily(control: ProbedControl): string {
  return `${control.tag}|${control.role ?? ""}|${control.name.split(" ").slice(0, FAMILY_WORDS).join(" ")}`;
}

function auditPage(
  ctx: Ctx,
  place: Place,
  probe: PageProbe,
  axeSource: string,
): number {
  const axe = ctx.browser.evaluate(
    axeProbe(axeSource),
  ) as readonly AxeViolation[];
  for (const v of axe) {
    const severity =
      v.impact === "critical" || v.impact === "serious" ? "medium" : "low";
    add(ctx, place, {
      severity,
      kind: `axe-${v.id}`,
      detail: `${v.help} (${v.nodes} nodes, e.g. ${v.sample})`,
    });
  }
  for (const g of probe.geometry) {
    const severity = g.kind.startsWith("target-under") ? "low" : "medium";
    add(ctx, place, {
      severity,
      kind: g.kind,
      detail: `${g.target}: ${g.detail}`,
    });
  }
  return axe.length;
}

type PageRef = Readonly<{ key: string; url: string; tag: string }>;

const identity = (c: ProbedControl): string =>
  `${c.tag}|${c.role ?? ""}|${c.name}`;

function liveControls(ctx: Ctx): ReadonlyMap<string, ProbedControl> {
  const probe = ctx.browser.evaluate(PAGE_PROBE) as PageProbe;
  const live = new Map<string, ProbedControl>();
  for (const c of probe.controls)
    if (!live.has(identity(c))) live.set(identity(c), c);
  return live;
}

/** A press can persist a view mode (tabs, radios) that a reload keeps: click the first-visit selection back. */
function revertSelection(
  ctx: Ctx,
  first: PageProbe,
): ReadonlyMap<string, ProbedControl> {
  const live = liveControls(ctx);
  for (const c of first.controls) {
    const now = c.selected ? live.get(identity(c)) : undefined;
    if (now && !now.selected)
      ctx.browser.batch([
        ["click", now.selector],
        ["wait", String(SETTLE_MS)],
      ]);
  }
  return liveControls(ctx);
}

function pressAll(
  ctx: Ctx,
  page: PageRef,
  probe: PageProbe,
): readonly StepRecord[] {
  const families = new Map<string, number>();
  const baseline = String(ctx.browser.evaluate(SIGNATURE_ONLY));
  let live = new Map(probe.controls.map((c) => [identity(c), c] as const));
  let pressed = 0;
  return probe.controls.map((control, i) => {
    const family = controlFamily(control);
    const repeated = families.get(family) === REPEAT_LIMIT;
    const capped = pressed >= ctx.config.maxControls;
    const target = live.get(identity(control));
    const reason =
      skipReason(control) ??
      (repeated
        ? `repeat: ${REPEAT_LIMIT} similar controls already pressed`
        : null) ??
      (capped
        ? `cap: more than ${ctx.config.maxControls} controls per page`
        : null) ??
      (target ? null : "gone: an earlier press changed the view");
    if (reason || !target) return skipped(control, reason ?? "gone");
    pressed += 1;
    families.set(family, (families.get(family) ?? 0) + 1);
    const step = pressControl(
      ctx,
      {
        key: page.key,
        url: page.url,
        shotBase: `${page.tag}-c${String(i).padStart(SHOT_INDEX_WIDTH, "0")}`,
      },
      target,
    );
    if (
      step.stateChanged &&
      String(ctx.browser.evaluate(SIGNATURE_ONLY)) !== baseline
    ) {
      live = new Map(revertSelection(ctx, probe));
    }
    return step;
  });
}

function visitPage(
  ctx: Ctx,
  url: string,
  index: number,
  axeSource: string,
): { record: PageRecord; links: readonly string[] } {
  const tag = `${String(index).padStart(2, "0")}-${slug(pageKey(url))}`;
  const loadMs = settle(ctx, url);
  const shot = `${tag}.png`;
  ctx.browser.batch([["screenshot", "--full", join(ctx.dir, shot)]]);
  const probe = ctx.browser.evaluate(PAGE_PROBE) as PageProbe;
  // The final URL decides the key: a redirect to sign-in means the session is gone.
  const key = pageKey(probe.url);
  drainLogs(ctx, { page: key, shot });
  const axeViolations = auditPage(ctx, { page: key, shot }, probe, axeSource);
  if (loadMs > SLOW_LOAD_MS)
    add(
      ctx,
      { page: key, shot },
      { severity: "low", kind: "slow-load", detail: `${loadMs} ms` },
    );
  if (key === "/") {
    add(
      ctx,
      { page: key, shot },
      {
        severity: "high",
        kind: "session-lost",
        detail: `${url} redirected to sign-in`,
      },
    );
  }
  const steps =
    key === "/" ? [] : pressAll(ctx, { key, url: probe.url, tag }, probe);
  const record: PageRecord = {
    url,
    key,
    loadMs,
    shot,
    controlsFound: probe.controls.length,
    axeViolations,
    geometryIssues: probe.geometry.length,
    steps,
  };
  return { record, links: probe.links };
}

/** A page whose browser calls keep timing out is recorded as aborted; the walk goes on to the next page. */
function visitWithRecovery(
  ctx: Ctx,
  url: string,
  index: number,
  axeSource: string,
): ReturnType<typeof visitPage> {
  try {
    return visitPage(ctx, url, index, axeSource);
  } catch (error: unknown) {
    const key = pageKey(url);
    const detail =
      error instanceof Error ? (error.message.split("\n")[0] ?? "") : "failed";
    add(
      ctx,
      { page: key, shot: null },
      { severity: "high", kind: "page-aborted", detail },
    );
    try {
      ctx.signIn();
    } catch {
      // the next page visit reports the failure again
    }
    const record: PageRecord = {
      url,
      key,
      loadMs: 0,
      shot: "",
      controlsFound: 0,
      axeViolations: 0,
      geometryIssues: 0,
      steps: [],
    };
    return { record, links: [] };
  }
}

/** Breadth-first walk over same-origin pages, one visit per page key. */
export function crawlPages(
  ctx: Ctx,
  start: string,
  axeSource: string,
): readonly PageRecord[] {
  const seen = new Set<string>();
  const queue = [start];
  const pages: PageRecord[] = [];
  for (
    let url = queue.shift();
    url !== undefined && pages.length < ctx.config.maxPages;
    url = queue.shift()
  ) {
    if (seen.has(pageKey(url))) continue;
    seen.add(pageKey(url));
    const { record, links } = visitWithRecovery(
      ctx,
      url,
      pages.length,
      axeSource,
    );
    pages.push(record);
    if (record.key === "/") break;
    const next = links.filter(
      (link) =>
        sameOrigin(link, ctx.config.url) &&
        !INTERNAL.test(new URL(link).pathname) &&
        !seen.has(pageKey(link)),
    );
    queue.push(...next);
  }
  return pages;
}
