/** In-page scripts evaluated through agent-browser. Each is a self-contained expression. */

export type ProbedControl = Readonly<{
  selector: string;
  tag: string;
  role: string | null;
  name: string;
  type: string | null;
  href: string | null;
  disabled: boolean;
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  clipped: boolean;
  obstructedBy: string | null;
  /** Checked, selected or pressed: the state a view toggle must be returned to. */
  selected: boolean;
  /** Option values of a native select other than the current one. */
  alternatives: readonly string[];
}>;

export type GeometryIssue = Readonly<{
  kind: string;
  target: string;
  detail: string;
}>;

export type PageProbe = Readonly<{
  url: string;
  title: string;
  viewport: Readonly<{ width: number; height: number }>;
  controls: readonly ProbedControl[];
  links: readonly string[];
  geometry: readonly GeometryIssue[];
}>;

const MIN_TARGET = 24;

/** Visible controls, page links and geometry issues (overflow, clipping, overlap, obstruction, small targets). */
export const PAGE_PROBE = String.raw`(() => {
  const short = (v, n = 90) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const path = (el) => {
    if (!el || el === document.documentElement) return 'html';
    const parent = el.parentElement;
    const same = parent ? [...parent.children].filter((c) => c.tagName === el.tagName) : [];
    const seg = el.tagName.toLowerCase() + (el.id ? '#' + CSS.escape(el.id) : ':nth-of-type(' + (same.indexOf(el) + 1) + ')');
    return path(parent) + ' > ' + seg;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (n.hidden || s.display === 'none' || s.visibility === 'hidden') return false;
      if (n.tagName === 'DETAILS' && !n.open && !n.querySelector(':scope > summary')?.contains(el)) return false;
    }
    return true;
  };
  const name = (el) => {
    const by = el.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    const labels = el.labels ? [...el.labels].map((l) => l.textContent).join(' ') : '';
    return short([by, el.getAttribute('aria-label'), labels, el.getAttribute('title'), el.textContent, el.getAttribute('placeholder')].find((c) => c && String(c).trim()) || '', 100);
  };
  const role = (el) => el.getAttribute('role') || ({A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox', SUMMARY: 'button'})[el.tagName] || (el.tagName === 'INPUT' ? (el.type === 'checkbox' || el.type === 'radio' ? el.type : 'textbox') : null);
  const intentional = (el) => [el, ...el.querySelectorAll('*')].some((n) => { const s = getComputedStyle(n); return s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none'); });
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=combobox]';
  const all = [...document.querySelectorAll(sel)].filter((el) => !el.closest('[inert], [aria-hidden=true]') && visible(el) && el.getBoundingClientRect().width > 2);
  const geometry = [];
  if (document.documentElement.scrollWidth > innerWidth + 2) geometry.push({kind: 'page-overflow-x', target: location.pathname, detail: 'scrollWidth ' + document.documentElement.scrollWidth + ' > viewport ' + innerWidth});
  const controls = all.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const clipped = (el.scrollWidth > el.clientWidth + 2 && !['visible', 'clip'].includes(cs.overflowX) && el.tagName !== 'INPUT') || (el.scrollHeight > el.clientHeight + 2 && !['visible', 'clip'].includes(cs.overflowY) && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT');
    const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
    const top = r.bottom > 0 && r.top < innerHeight ? document.elementFromPoint(x, y) : null;
    const reachable = !top || top === el || el.contains(top) || top.contains(el) || top.closest('label')?.control === el;
    const nameText = name(el);
    if (clipped && !intentional(el)) geometry.push({kind: 'control-clipped', target: short(nameText, 60), detail: 'content ' + el.scrollWidth + 'x' + el.scrollHeight + ' in box ' + el.clientWidth + 'x' + el.clientHeight});
    if (!reachable) geometry.push({kind: 'control-obstructed', target: nameText, detail: 'covered by ' + path(top)});
    if ((r.width < ${MIN_TARGET} || r.height < ${MIN_TARGET}) && !['checkbox', 'radio'].includes(el.type ?? '')) geometry.push({kind: 'target-under-${MIN_TARGET}', target: nameText, detail: Math.round(r.width) + 'x' + Math.round(r.height)});
    return {selector: path(el), tag: el.tagName.toLowerCase(), role: role(el), name: nameText, type: el.getAttribute('type'),
      href: el.tagName === 'A' ? el.href : null, disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
      bounds: {x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height)}, clipped, obstructedBy: reachable ? null : path(top),
      selected: el.checked === true || ['aria-checked', 'aria-selected', 'aria-pressed'].some((a) => el.getAttribute(a) === 'true') || el.getAttribute('data-state') === 'on',
      alternatives: el.tagName === 'SELECT' ? [...el.options].filter((o) => !o.disabled && o.value !== el.value).map((o) => o.value) : []};
  });
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i].bounds, b = controls[j].bounds;
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const nested = (p, q) => p.x <= q.x && p.y <= q.y && p.x + p.width >= q.x + q.width && p.y + p.height >= q.y + q.height;
    if (w > 4 && h > 4 && !nested(a, b) && !nested(b, a)) geometry.push({kind: 'controls-overlap', target: controls[i].name + ' / ' + controls[j].name, detail: w + 'x' + h + ' px'});
  }
  const links = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href.split('#')[0]).filter(Boolean))];
  return {url: location.href, title: document.title, viewport: {width: innerWidth, height: innerHeight}, controls, links, geometry};
})()`;

/** Compact fingerprint of observable UI state: URL, open dialogs and menus, expanded flags, text. */
export const STATE_SIGNATURE = `(() => {
  const text = document.body.innerText;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  const open = document.querySelectorAll('dialog[open], [role=dialog], [role=menu], [role=listbox], [data-state=open]').length;
  const expanded = [...document.querySelectorAll('[aria-expanded], details')].map((e) => e.getAttribute('aria-expanded') ?? e.open).join(',');
  const checked = [...document.querySelectorAll('input, [role=switch], [role=tab]')].map((e) => e.checked ?? e.getAttribute('aria-selected') ?? e.getAttribute('aria-checked')).join(',');
  return location.href + '|' + open + '|' + expanded + '|' + checked + '|' + text.length + ':' + hash;
})()`;

export function axeProbe(axeSource: string): string {
  return `(async () => { ${axeSource}
  const r = await axe.run(document, {resultTypes: ['violations']});
  return r.violations.map((v) => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') ?? ''}));
})()`;
}

/** Starts watching DOM and network activity; returns the state signature before the press. */
export const PRESS_BEGIN = `(() => {
  const old = window.__crawl;
  old?.mo.disconnect();
  old?.po.disconnect();
  const now = performance.now();
  const watch = {t0: now, last: now, mo: null, po: null};
  watch.mo = new MutationObserver(() => { watch.last = performance.now(); });
  watch.mo.observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
  watch.po = new PerformanceObserver(() => { watch.last = performance.now(); });
  watch.po.observe({type: 'resource'});
  window.__crawl = watch;
  return ${STATE_SIGNATURE};
})()`;

/** Signature after the press and the time the page kept changing (response time). */
export const PRESS_END = `(() => {
  const watch = window.__crawl;
  return {sig: ${STATE_SIGNATURE}, ms: watch ? Math.round(watch.last - watch.t0) : null};
})()`;

export const SIGNATURE_ONLY = STATE_SIGNATURE;
