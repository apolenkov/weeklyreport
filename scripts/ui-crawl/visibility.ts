/** Client-side visibility and obstruction predicates for crawl batch pressing. */
export const VISIBILITY_SCRIPT = `(() => {
  const isClippedByOverflow = (el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY)) {
        const pr = p.getBoundingClientRect();
        if (r.right <= pr.left || r.left >= pr.right || r.bottom <= pr.top || r.top >= pr.bottom) return true;
        if (pr.width <= 0 || pr.height <= 0) return true;
      }
    }
    return false;
  };
  const isVisibleAndReachable = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (n.hidden || s.display === 'none' || s.visibility === 'hidden') return false;
      if (s.transform && s.transform.includes('matrix') && s.transform.startsWith('matrix(')) {
        const parts = s.transform.slice(7, -1).split(',').map((x) => parseFloat(x.trim()));
        if (parts.length >= 4 && (parts[0] === 0 || parts[3] === 0)) return false;
      }
      if (n.tagName === 'DETAILS' && !n.open && !n.querySelector(':scope > summary')?.contains(el)) return false;
    }
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    if (left >= right || top >= bottom) return false;
    if (isClippedByOverflow(el)) return false;
    return true;
  };
  const covered = (el) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    const elements = document.elementsFromPoint ? document.elementsFromPoint((left + right) / 2, (top + bottom) / 2) : [document.elementFromPoint((left + right) / 2, (top + bottom) / 2)].filter(Boolean);
    const blocker = elements.find((node) => {
      if (node === el || el.contains(node) || node.contains(el)) return false;
      if (node.closest('label')?.control === el) return false;
      const s = getComputedStyle(node);
      if (s.pointerEvents === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
      return true;
    });
    return !!blocker;
  };
  return { isVisibleAndReachable, covered };
})()`;
