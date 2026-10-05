/** Presses a series of controls inside the page: one browser call for many presses. */
import {
  DOM_GRACE_MS,
  MAX_QUIET_MS,
  QUIET_MS,
  REPRESS_NAME_CHARS,
  RETURN_WAIT_MS,
} from "./constants.ts";
import type { Browser } from "./driver.ts";
import { type ProbedControl, SIGNATURE_ONLY } from "./probe.ts";

export type PressLog = Readonly<{ kind: string; detail: string }>;

export type PressResult = Readonly<{
  /** Index into the submitted list. */
  n: number;
  status: "ok" | "gone" | "obstructed";
  before: string;
  after: string;
  urlChanged: boolean;
  /** Time the page kept changing after the press (DOM mutations or requests). */
  ms: number;
  /** Longest main-thread task during the press. */
  blockedMs: number;
  logs: readonly PressLog[];
}>;

export type BatchOutcome = Readonly<{
  results: readonly PressResult[];
  /** True when the run ended early on a visible change, a navigation or the time budget. */
  stopped: boolean;
  /** tRPC requests the page made during the run. */
  req: number;
  /** Time spent inside the page script. */
  took: number;
}>;

/** Installs console, error, fetch and XHR listeners once per document and tracks page activity. */
const HOOKS = `(() => {
  if (window.__crawl2) return window.__crawl2;
  // A "leave this page?" prompt (an open reply form) blocks reload and every later browser call.
  const listen = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) { return type === 'beforeunload' ? undefined : listen.call(this, type, ...rest); };
  Object.defineProperty(window, 'onbeforeunload', {get: () => null, set: () => {}, configurable: true});
  const S = {logs: [], inflight: 0, last: performance.now(), net: performance.now(), blocked: 0, req: 0};
  const push = (kind, detail) => S.logs.push({kind, detail: String(detail).slice(0, 300)});
  const touch = () => { S.last = performance.now(); };
  const touchNet = () => { S.net = S.last = performance.now(); };
  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...args) => { push('console-' + level, args.map(String).join(' ')); original(...args); };
  }
  addEventListener('error', (e) => push('page-error', e.message || 'resource failed: ' + (e.target?.src ?? e.target?.href ?? e.target?.tagName)), true);
  addEventListener('unhandledrejection', (e) => push('page-error', 'unhandled rejection: ' + (e.reason?.message ?? e.reason)));
  const failed = (status, method, url) => { push('network', status + ' ' + method + ' ' + url); if (status >= 400) push(status === 429 ? 'rate-limited' : 'http-error', status + ' ' + method + ' ' + url); };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    S.inflight++; touchNet();
    try {
      const response = await nativeFetch(input, init);
      failed(response.status, init?.method ?? input?.method ?? 'GET', input?.url ?? input);
      return response;
    } finally { S.inflight--; touchNet(); }
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener('loadstart', () => { S.inflight++; touchNet(); });
    this.addEventListener('loadend', () => { S.inflight--; touchNet(); failed(this.status, method, url); });
    return open.call(this, method, url, ...rest);
  };
  new MutationObserver(touch).observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
  new PerformanceObserver((l) => { touchNet(); for (const e of l.getEntries()) if (e.name.includes('/trpc/')) S.req++; }).observe({type: 'resource', buffered: true});
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { S.blocked = Math.max(S.blocked, e.duration); })).observe({type: 'longtask'}); } catch {}
  return (window.__crawl2 = S);
})()`;

/**
 * Resolves once no request is in flight and the page was still for QUIET_MS. A page that keeps
 * mutating on its own (animation, ticking clock) is given DOM_GRACE_MS after the last request.
 */
const QUIET = `(S, maxMs) => new Promise((resolve) => {
  const t0 = performance.now();
  const tick = () => {
    const now = performance.now();
    const still = now - S.last >= ${QUIET_MS} || now - S.net >= ${DOM_GRACE_MS};
    if ((S.inflight === 0 && still && now - S.net >= ${QUIET_MS}) || now - t0 > maxMs) resolve();
    else setTimeout(tick, 15);
  };
  tick();
})`;

/**
 * Resolves true as soon as `test()` holds, driven by DOM mutations, or false after `ms`.
 * A page that is still returning from a reload or a dismissed surface is waited for, not skipped.
 */
export const UNTIL = `(test, ms) => new Promise((resolve) => {
  if (test()) return resolve(true);
  const done = (ok) => { observer.disconnect(); clearTimeout(timer); resolve(ok); };
  const observer = new MutationObserver(() => { if (test()) done(true); });
  const timer = setTimeout(() => done(false), ms);
  observer.observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
})`;

const PRESS = `(el, alternative) => {
  if (alternative !== undefined) {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, alternative);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    return;
  }
  const r = el.getBoundingClientRect();
  const init = {bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: window};
  el.dispatchEvent(new PointerEvent('pointerdown', init));
  el.dispatchEvent(new MouseEvent('mousedown', init));
  el.focus?.();
  el.dispatchEvent(new PointerEvent('pointerup', init));
  el.dispatchEvent(new MouseEvent('mouseup', init));
  el.click();
}`;

/** Script for one batch of presses; stops at the first visible change so the caller can look at it. */
function batchScript(
  items: readonly Readonly<{ selector: string; alternative?: string }>[],
  budgetMs: number,
  maxQuietMs: number,
): string {
  return `(async () => {
  const S = ${HOOKS};
  const quiet = ${QUIET};
  const press = ${PRESS};
  const until = ${UNTIL};
  const state = () => ${SIGNATURE_ONLY};
  const items = ${JSON.stringify(items)};
  const results = [];
  S.req = 0;
  const keep = () => sessionStorage.setItem('__crawlRes', JSON.stringify(results));
  keep();
  const started = performance.now();
  const covered = (el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)), Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2)));
    return !!top && top !== el && !el.contains(top) && !top.contains(el) && top.closest('label')?.control !== el;
  };
  let waitedOut = false;
  for (let n = 0; n < items.length; n++) {
    let el = document.querySelector(items[n].selector);
    // a control missing because the page is still coming back is waited for; after one wait that ran out the rest are gone for good
    if (!el && !waitedOut) {
      waitedOut = !(await until(() => !!document.querySelector(items[n].selector), ${RETURN_WAIT_MS}));
      el = document.querySelector(items[n].selector);
    }
    const base = {n, before: '', after: '', urlChanged: false, ms: 0, blockedMs: 0, logs: []};
    if (!el) { results.push({...base, status: 'gone'}); keep(); continue; }
    el.scrollIntoView?.({block: 'nearest'});
    if (items[n].alternative === undefined && covered(el)) { results.push({...base, status: 'obstructed'}); keep(); continue; }
    S.logs = []; S.blocked = 0;
    const before = state();
    const url = location.href;
    const t0 = performance.now();
    S.last = t0;
    press(el, items[n].alternative);
    await quiet(S, ${maxQuietMs});
    const after = state();
    const urlChanged = location.href !== url;
    results.push({...base, status: 'ok', before, after, urlChanged, ms: Math.round(Math.min(S.last, Math.max(S.net, t0) + ${DOM_GRACE_MS}) - t0), blockedMs: Math.round(S.blocked), logs: S.logs});
    keep();
    if (after !== before || urlChanged || performance.now() - started > ${budgetMs}) return {results, stopped: n + 1 < items.length || after !== before || urlChanged, req: S.req, took: Math.round(performance.now() - started)};
  }
  return {results, stopped: false, req: S.req, took: Math.round(performance.now() - started)};
})()`;
}

/** Presses `controls` in order inside the page; see {@link batchScript}. */
export function pressBatch(
  browser: Browser,
  controls: readonly ProbedControl[],
  budgetMs: number,
  maxQuietMs: number,
): BatchOutcome {
  const items = controls.map((c) =>
    c.tag === "select" && c.alternatives[0] !== undefined
      ? { selector: c.selector, alternative: c.alternatives[0] }
      : { selector: c.selector },
  );
  return browser.evaluate(
    batchScript(items, budgetMs, maxQuietMs),
  ) as BatchOutcome;
}

/** Presses one control again (undoes an expander or a toggle) and returns the quiet state signature. */
export function repress(
  browser: Browser,
  selector: string,
  name: string,
): string {
  return String(
    browser.evaluate(String.raw`(async () => {
  const S = ${HOOKS};
  const el = document.querySelector(${JSON.stringify(selector)});
  const text = (e) => [e.getAttribute('aria-label'), e.textContent].map((t) => String(t ?? '').replace(/\s+/g, ' ').trim());
  // the path may now lead to another control (an opened form replaces its trigger): never press that one
  if (el && text(el).some((t) => t && t.startsWith(${JSON.stringify(name.slice(0, REPRESS_NAME_CHARS))}))) (${PRESS})(el);
  await (${QUIET})(S, ${MAX_QUIET_MS});
  return ${SIGNATURE_ONLY};
})()`),
  );
}

/**
 * Escape sent from inside the page, then the quiet state signature. The CLI's own Escape key press
 * can leave the browser unresponsive for every later call (seen after a details toggle).
 */
export function escapeState(browser: Browser): string {
  return String(
    browser.evaluate(`(async () => {
  const S = ${HOOKS};
  for (const type of ['keydown', 'keyup'])
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent(type, {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true}));
  await (${QUIET})(S, ${MAX_QUIET_MS});
  return ${SIGNATURE_ONLY};
})()`),
  );
}

/** tRPC requests since the last call (counted from page load, so a fresh document reports its own). */
export function takeRequests(browser: Browser): number {
  return Number(
    browser.evaluate(
      `(() => { const S = ${HOOKS}; const n = S.req; S.req = 0; return n; })()`,
    ),
  );
}

/** Script: wait for the page to go quiet, then return its state signature. */
const QUIET_STATE = `(async () => { const S = ${HOOKS}; await (${QUIET})(S, ${MAX_QUIET_MS}); return ${SIGNATURE_ONLY}; })()`;

export function quietState(browser: Browser): string {
  return String(browser.evaluate(QUIET_STATE));
}

/** Results a batch stored before its browser call failed (navigation, timeout). */
export function recoverResults(browser: Browser): readonly PressResult[] {
  try {
    const raw = browser.evaluate(
      "sessionStorage.getItem('__crawlRes') ?? '[]'",
    );
    return JSON.parse(String(raw)) as PressResult[];
  } catch {
    return [];
  }
}

/** Waits, driven by DOM mutations, until the page state equals `baseline` or `ms` pass; returns the state seen last. */
export function waitForState(
  browser: Browser,
  baseline: string,
  ms = RETURN_WAIT_MS,
): string {
  return String(
    browser.evaluate(`(async () => {
  const S = ${HOOKS};
  const state = () => ${SIGNATURE_ONLY};
  await (${UNTIL})(() => state() === ${JSON.stringify(baseline)}, ${ms});
  await (${QUIET})(S, ${MAX_QUIET_MS});
  return state();
})()`),
  );
}
