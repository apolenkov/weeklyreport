import { quietState, UNTIL, waitForState } from "./batch.ts";
import { RETURN_WAIT_MS, SLOW_LOAD_MS } from "./constants.ts";
import { add, type Ctx, drainLogs, type Place } from "./logs.ts";
import { retryPage } from "./page-retry.ts";
import { pageKey, sameOrigin } from "./policy.ts";
import { settle } from "./press.ts";
import {
  axeProbe,
  PAGE_PROBE,
  type PageProbe,
  type ProbedControl,
  SIGNATURE_ONLY,
} from "./probe.ts";
import {
  type Counters,
  identity,
  type PageRef,
  planEntries,
  pressEntries,
} from "./round.ts";
import { captureScreenshot } from "./screenshot.ts";
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

/**
 * Waits, driven by DOM mutations, until every wanted control is on the page (or RETURN_WAIT_MS pass):
 * a page that is still rendering after a reload must not make its controls look gone.
 */
function awaitControls(wanted: readonly string[]): string {
  return `(async () => {
  const read = () => ${PAGE_PROBE};
  const want = ${JSON.stringify(wanted)};
  const complete = () => {
    const ids = new Set(read().controls.map((c) => c.tag + '|' + (c.role ?? '') + '|' + c.name));
    return want.every((w) => ids.has(w));
  };
  await (${UNTIL})(complete, ${RETURN_WAIT_MS});
  return read();
})()`;
}

function liveControls(
  ctx: Ctx,
  wanted?: readonly string[],
): ReadonlyMap<string, ProbedControl> {
  const probe = ctx.browser.evaluate(
    wanted ? awaitControls(wanted) : PAGE_PROBE,
  ) as PageProbe;
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
  const live = liveControls(ctx, first.controls.map(identity));
  let reverted = false;
  for (const c of first.controls) {
    const now = c.selected ? live.get(identity(c)) : undefined;
    if (now && !now.selected) {
      ctx.browser.batch([["click", now.selector]]);
      quietState(ctx.browser);
      reverted = true;
    }
  }
  return reverted ? liveControls(ctx, first.controls.map(identity)) : live;
}

function pressAll(
  ctx: Ctx,
  page: PageRef,
  probe: PageProbe,
): readonly StepRecord[] {
  const counters: Counters = { pressed: 0, families: new Map() };
  const baseline = String(ctx.browser.evaluate(SIGNATURE_ONLY));
  let live: ReadonlyMap<string, ProbedControl> = new Map(
    probe.controls.map((c) => [identity(c), c] as const),
  );
  const steps: StepRecord[] = [];
  let reported = false;
  for (let next = 0; next < probe.controls.length;) {
    const entries = planEntries(ctx, { probe, live, counters }, next);
    const round = pressEntries(ctx, page, entries, counters);
    steps.push(...round.steps);
    if (round.aborted) break;
    next = round.next ?? probe.controls.length;
    const last = round.steps.at(-1);
    // An Escape that restored the exact state needs no further check; after a reload, wait for the baseline to return, then compare.
    if (
      last?.stateChanged &&
      last.restoredBy !== "escape" &&
      last.restoredBy !== "toggle" &&
      waitForState(ctx.browser, baseline) !== baseline
    ) {
      live = revertSelection(ctx, probe);
      // a page that never returns to its first-visit state is an error, not a run of vanished controls
      if (
        !reported &&
        String(ctx.browser.evaluate(SIGNATURE_ONLY)) !== baseline
      ) {
        reported = true;
        add(
          ctx,
          { page: page.key, shot: null },
          {
            severity: "low",
            kind: "restore-incomplete",
            detail: `${last.name}: the page did not return to its first-visit state; later controls that the page no longer shows are reported as gone`,
          },
        );
      }
    }
  }
  return steps;
}

function visitPage(
  ctx: Ctx,
  url: string,
  index: number,
  axeSource: string,
): { record: PageRecord; links: readonly string[] } {
  const tag = `${String(index).padStart(2, "0")}-${slug(pageKey(url))}`;
  const loadMs = settle(ctx, url, "visit");
  const shot = captureScreenshot(ctx, {
    page: pageKey(url),
    filename: `${tag}.png`,
    full: true,
  });
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

/** A browser call that times out gets the page one more try after signing in again; a second failure is recorded and the walk goes on. */
function visitWithRecovery(
  ctx: Ctx,
  url: string,
  index: number,
  axeSource: string,
): ReturnType<typeof visitPage> {
  const result = retryPage(ctx, () => visitPage(ctx, url, index, axeSource));
  if (result.ok) return result.value;
  const { detail } = result;
  const key = pageKey(url);
  add(
    ctx,
    { page: key, shot: null },
    { severity: "high", kind: "page-aborted", detail },
  );
  const record: PageRecord = {
    url,
    key,
    loadMs: 0,
    shot: null,
    controlsFound: 0,
    axeViolations: 0,
    geometryIssues: 0,
    steps: [],
  };
  return { record, links: [] };
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
