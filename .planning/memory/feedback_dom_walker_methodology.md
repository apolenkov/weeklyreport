---
name: DOM-walker side-effect coverage methodology
description: Use DOM as canonical inventory of "what user can do" — find mutations without visible consumers (silent black-holes like console.log-only writes)
type: feedback
---

User caught reopen-request black-hole: form had a working "Send Request" button, the mutation ran fine, the toast said success — but the row was never persisted (`console.log` only) and there was no admin UI to surface it. Functional tests + screenshot tests passed because they only check the immediate response, not the full lifecycle.

**Rule:** for any mutation, verify the _consumer_ exists. The DOM walker pattern below is the systematic way to find these gaps.

**Why:** UI tests verify "click → expected immediate effect" but miss "is the side-effect ever observable elsewhere in the app?". A button that writes to /dev/null still toasts "Success!".

**How to apply (DOM-walker tool):**

```
For each (route × role × state) tuple:
  1. dump document.querySelectorAll('
       button, a[href], [role=button|tab|menuitem],
       input, select, textarea, [contenteditable],
       [aria-haspopup]
     ')
  2. For each node, capture:
     {selector, label, ariaLabel, dataTestid, route, role, state}
  3. Auto-generate scenario skeleton:
     "User clicks X → expect [route-change | toast | dialog | mutation | DB-row-delta]"
  4. For mutations specifically: check there is at least one component that
     renders (or could render) that mutation's result. If not → red flag.

Output: interaction-inventory.csv + side-effect-coverage.md.
Run as part of pre-release sanity gate.
```

**Avoid:** declaring "tests pass, ship it" when no test verifies the _observability_ of mutations across the system. Toasts are not consumers; they're acknowledgments.

**Concrete next step:** task #92 in this repo's task tracker — build the DOM-walker tool. Should run as `pnpm uat:inventory` and emit a coverage matrix.
