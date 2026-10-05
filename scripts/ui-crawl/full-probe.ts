import { UNTIL } from "./batch.ts";
import { RETURN_WAIT_MS } from "./constants.ts";
import type { Browser } from "./driver.ts";
import {
  type PageProbe,
  pageProbeScript,
  type ProbedControl,
} from "./probe.ts";

export type FullControl = ProbedControl &
  Readonly<{
    elementId: string;
    row: Readonly<{ id: string; family: string }> | null;
    surface: string | null;
    form: boolean;
    group: string | null;
    value: string;
    expanded: boolean;
    options: readonly string[];
  }>;

export type FullProbe = Omit<PageProbe, "controls"> &
  Readonly<{
    controls: readonly FullControl[];
    signature: string;
    surface: string | null;
  }>;

/** Ancestry, not the label alone, distinguishes identical actions in different rows. */
const fullProbeScript = (geometry: boolean): string => String.raw`(() => {
  const page = ${pageProbeScript(geometry)};
  const compact = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const path = (el) => {
    if (!el || el === document.documentElement) return 'html';
    const siblings = [...el.parentElement.children].filter((n) => n.tagName === el.tagName);
    return path(el.parentElement) + '/' + el.tagName.toLowerCase() + ':' + (siblings.indexOf(el) + 1);
  };
  const visible = (el) => !!el.getClientRects().length && !el.closest('[hidden],[inert],[aria-hidden=true]') && getComputedStyle(el).visibility !== 'hidden';
  const surfaceSelector = 'dialog[open],[role=dialog],[role=alertdialog],[role=menu],[role=listbox]';
  const surfaces = [...document.querySelectorAll(surfaceSelector)].filter(visible);
  const surfaceId = (el) => el ? path(el) + '|' + compact(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) : null;
  const active = surfaces.at(-1) ?? null;
  const rowSelector = 'tr,[role=row],li,article,[data-overview-item-preview]';
  const actionSelector = 'button,a[href],select,summary,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem]';
  const actionName = (el) => compact(el.getAttribute('data-overview-focus')?.split(':')[0] || el.textContent || el.getAttribute('aria-label')).replace(/\s+for\s+.+|:\s+.+$/i, '');
  const rowInfo = (el) => {
    const row = el.closest(rowSelector);
    if (!row || row.closest(surfaceSelector)) return null;
    const shape = [...row.querySelectorAll(actionSelector)].map((n) => [n.tagName,n.getAttribute('role'),actionName(n),n.matches(':disabled')]);
    return {id: path(row), family: path(row.parentElement) + '|' + JSON.stringify(shape)};
  };
  const controls = page.controls.map((control) => {
    const el = document.querySelector(control.selector);
    const owner = el.closest(surfaceSelector);
    const fieldset = el.closest('[role=tablist],[role=radiogroup],fieldset');
    const group = fieldset ? path(fieldset) : el.type === 'radio' && el.name ? path(el.form || el.parentElement) + '|' + el.name : null;
    return {...control,
      elementId: path(el) + '|' + control.tag + '|' + (control.role ?? '') + '|' + compact(el.getAttribute('aria-label') || control.name),
      row: rowInfo(el), surface: surfaceId(owner), form: !!el.closest('form'), group,
      value: String(el.value ?? ''), expanded: el.getAttribute('aria-expanded') === 'true' || (el.tagName === 'SUMMARY' && el.parentElement.open),
      options: el.tagName === 'SELECT' ? [...el.options].filter((o) => !o.disabled).map((o) => o.value) : []};
  });
  // Order- and path-independent: a list that re-sorts itself is still the same state.
  const surfaceLabel = (el) => (el.getAttribute('role') || el.tagName.toLowerCase()) + ':' + compact(el.getAttribute('aria-label') || document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent || el.textContent).slice(0, 60);
  const signature = JSON.stringify([location.origin + location.pathname + location.search, surfaces.map(surfaceLabel), controls.map((c) => JSON.stringify([c.tag,c.role,c.name,c.selected,c.expanded,c.value,c.disabled,!!c.surface])).sort()]);
  return {...page, controls, signature, surface: surfaceId(active)};
})()`;

const FULL_PROBE = fullProbeScript(true);
/** Controls and signature without the layout checks: what finding, comparing and restoring need. */
const LIGHT_PROBE = fullProbeScript(false);

/** Light by default; `geometry` adds the layout checks that evidence needs. */
export function readFullProbe(browser: Browser, geometry = false): FullProbe {
  return browser.evaluate(geometry ? FULL_PROBE : LIGHT_PROBE) as FullProbe;
}

/** Probe once the page shows `signature` (waited for by DOM mutations) or `ms` pass; the probe is whatever the page shows then. */
export function awaitFullProbe(
  browser: Browser,
  signature: string,
  ms = RETURN_WAIT_MS,
): FullProbe {
  return browser.evaluate(`(async () => {
  const read = () => ${LIGHT_PROBE};
  await (${UNTIL})(() => read().signature === ${JSON.stringify(signature)}, ${ms});
  return read();
})()`) as FullProbe;
}
