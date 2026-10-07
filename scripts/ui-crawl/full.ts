import { SLOW_LOAD_MS } from "./constants.ts";
import { pageCoverage } from "./coverage.ts";
import { fullFamilyKey, fullPageKey } from "./full-plan.ts";
import { type FullProbe, readFullProbe } from "./full-probe.ts";
import { type FullSession, rebaseAfterWrite } from "./full-session.ts";
import { walkFrame } from "./full-walk.ts";
import { add, type Ctx, drainLogs } from "./logs.ts";
import { retryPage } from "./page-retry.ts";
import { sameOrigin } from "./policy.ts";
import { settle } from "./press.ts";
import type { PageRecord } from "./types.ts";

/** How many times one page may restart from a written baseline. */
const MAX_REBASES = 6;
const INTERNAL = /\/(api|auth|monitoring|print)\b|logout|sign-?out/i;

type Visit = Readonly<{ record: PageRecord; links: readonly string[] }>;

function slug(key: string): string {
  return key.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "") || "root";
}

function sessionFor(
  ctx: Ctx,
  axeSource: string,
  tag: string,
  home: FullSession["home"],
): FullSession {
  return {
    ctx,
    home,
    axeSource,
    tag,
    steps: [],
    states: [],
    pairs: [],
    links: new Set(),
    visited: new Set(),
    representatives: new Map(),
    done: new Set(),
    probeCache: null,
    presses: 0,
    limited: false,
    aborted: false,
    mutated: false,
    axeViolations: 0,
    geometryIssues: 0,
  };
}

function emptyRecord(
  ctx: Ctx,
  url: string,
  key: string,
  loadMs: number,
): PageRecord {
  return {
    url,
    key,
    loadMs,
    shot: null,
    controlsFound: 0,
    axeViolations: 0,
    geometryIssues: 0,
    steps: [],
    state: ctx.config.state,
    completion: "error",
  };
}

/** A write restarts the walk from the reloaded page; the controls already finished are not repeated. */
function walkRebasing(session: FullSession, probe: FullProbe): void {
  let current = probe;
  for (let rebased = 0; rebased <= MAX_REBASES; rebased += 1) {
    walkFrame(session, {
      probe: current,
      path: [],
      depth: 0,
      known: new Set(),
    });
    if (session.aborted || !session.mutated) return;
    current = rebaseAfterWrite(session);
  }
  session.limited = true;
}

/** The page to open, its number in the run and the page keys already walked (a redirect can land on one of them). */
type Target = Readonly<{
  url: string;
  index: number;
  seen: ReadonlySet<string>;
}>;

function visitFullPage(
  ctx: Ctx,
  { url, index, seen }: Target,
  axeSource: string,
): Visit | null {
  const loadMs = settle(ctx, url, "visit");
  const probe = readFullProbe(ctx.browser);
  const key = fullPageKey(probe.url);
  if (seen.has(key)) return null;
  const tag = `${String(index).padStart(2, "0")}-${slug(key)}`;
  const place = { page: key, shot: `${tag}-s0.png` };
  drainLogs(ctx, place);
  if (loadMs > SLOW_LOAD_MS)
    add(ctx, place, {
      severity: "low",
      kind: "slow-load",
      detail: `${loadMs} ms`,
    });
  if (new URL(probe.url).pathname === "/" && new URL(url).pathname !== "/") {
    add(
      ctx,
      { page: key, shot: null },
      {
        severity: "high",
        kind: "session-lost",
        detail: `${url} redirected to sign-in`,
      },
    );
    return { record: emptyRecord(ctx, url, key, loadMs), links: [] };
  }
  const session = sessionFor(ctx, axeSource, tag, {
    key,
    url: probe.url,
    probe,
  });
  walkRebasing(session, probe);
  const first = session.states[0];
  const counts = pageCoverage(session.steps);
  const failed = session.aborted || counts.errors > 0;
  const record: PageRecord = {
    url,
    key,
    loadMs,
    shot: first?.shot ?? null,
    controlsFound: probe.controls.length,
    axeViolations: session.axeViolations,
    geometryIssues: session.geometryIssues,
    steps: session.steps,
    state: ctx.config.state,
    coverage: counts,
    states: session.states,
    pairwise: session.pairs,
    completion: failed ? "error" : session.limited ? "limited" : "complete",
  };
  return { record, links: [...session.links] };
}

/** A failed browser call gets the page one more try after signing in again; a second failure is recorded and the walk goes on. */
function visitWithRecovery(
  ctx: Ctx,
  target: Target,
  axeSource: string,
): Visit | null {
  const result = retryPage(ctx, () => visitFullPage(ctx, target, axeSource));
  if (result.ok) return result.value;
  const { detail } = result;
  const { url } = target;
  const key = fullPageKey(url);
  add(
    ctx,
    { page: key, shot: null },
    {
      severity: "high",
      kind: "page-aborted",
      detail,
    },
  );
  return { record: emptyRecord(ctx, url, key, 0), links: [] };
}

/** Same-origin page links of an unseen family; the synthetic pass writes, so it stays on the prepared entrypoints. */
function newLinks(
  ctx: Ctx,
  links: readonly string[],
  seenFamily: Set<string>,
): readonly string[] {
  if (ctx.config.allowSynthetic) return [];
  const fresh: string[] = [];
  for (const link of links) {
    const family = fullFamilyKey(link);
    if (
      sameOrigin(link, ctx.config.url) &&
      !INTERNAL.test(new URL(link).pathname) &&
      !seenFamily.has(family)
    ) {
      seenFamily.add(family);
      fresh.push(link);
    }
  }
  return fresh;
}

/**
 * Walks the prepared entrypoints, then every page family they link to (record ids collapse into one
 * representative, query views such as admin tabs stay separate), recursing into each page's surfaces.
 */
export function crawlFullPages(
  ctx: Ctx,
  landing: string,
  axeSource: string,
): readonly PageRecord[] {
  const entries = ctx.config.entrypoints.map(
    (path) => new URL(path, ctx.config.url).href,
  );
  const queue = entries.length > 0 ? [...entries] : [landing];
  const requested = new Set<string>();
  const walked = new Set<string>();
  const seenFamily = new Set<string>(entries.map(fullFamilyKey));
  const pages: PageRecord[] = [];
  for (
    let url = queue.shift();
    url !== undefined && pages.length < ctx.config.maxPages;
    url = queue.shift()
  ) {
    const exact = fullPageKey(url);
    if (requested.has(exact)) continue;
    requested.add(exact);
    seenFamily.add(fullFamilyKey(url));
    const visit = visitWithRecovery(
      ctx,
      { url, index: pages.length, seen: walked },
      axeSource,
    );
    if (!visit) continue;
    const { record, links } = visit;
    walked.add(record.key);
    pages.push(record);
    console.error(
      `[${ctx.role.name}@${ctx.width}] ${record.key}: ${record.completion ?? "?"}, ${record.states?.length ?? 0} states, ${record.steps.length} controls`,
    );
    if (record.key === "/") break;
    queue.push(...newLinks(ctx, links, seenFamily));
  }
  return pages;
}
