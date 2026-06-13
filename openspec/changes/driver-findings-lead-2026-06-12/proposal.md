# Driver Findings — Lead Role (2026-06-12)

## Why

During the overnight marathon (run `wf_d2d739f7-3a7`) the ai-ui-driver
completed the **lead** role and surfaced 5 findings before the run hit the
account weekly limit. The driver's own consolidation step (which normally
writes findings into an OpenSpec change) was killed by the same limit, so
these findings were extracted from the workflow journal by hand and captured
here so they are not lost.

Scope note: this is **lead role only**. The head / admin / viewer driver runs
never executed (weekly limit, resets 2026-06-13 12:00 Europe/Moscow). A
follow-up run should cover those three roles and may add findings.

Each finding was produced by the driver and adversarially re-checked once by
the verify pass. Per repo memory the driver's skeptic both false-confirms and
false-dismisses, so every finding below must be **re-verified in the live
browser** before its fix is committed.

## What Changes

No behavioral contract is asserted by this capture itself. It records 5
findings and splits them by fix-risk so the low-risk pair can land tonight and
the risky three wait for an explicit human decision.

### Low-risk (cosmetic / isolated)

1. **Dead search deep-link anchor** — `/reports` search results link to
   `/lead/report/[reportId]#section-<id>`, but the lead form renders no
   matching `#section-<id>` target, so the anchor is inert (lands at page top).
   Route: `/reports → /lead/report/[reportId]`.
2. **Hardcoded plural "1 items"** — the product accordion prints
   "Current Week · 1 items" with a hardcoded plural noun.
   Route: `/reports/[reportId]`.

### Risky (logic / data / product decision — needs confirmation)

3. **Raw Zod JSON leaked to the user on a bad reportId** — visiting
   `/lead/report/[reportId]` with an invalid id renders the raw Zod validation
   JSON to the user, and the 400 is retried 3 times. Needs a real error
   surface + no-retry on 4xx.
   Route: `/lead/report/[reportId]`.
4. **Lead preview shows the whole portfolio, not the lead's section** —
   `/lead/report/[reportId]/preview` renders all 11 products instead of the
   lead's own section. This is a **product decision**: is the preview meant to
   show the unified report (intended) or the lead's slice (the finding's
   assumption)? Code/catalog divergence — do not "fix" without deciding.
   Route: `/lead/report/[reportId]/preview`.
5. **Stale export-PDF catalog intents for the lead role** — oracle intents
   `lead-export-preview-pdf` and `lead-export-pdf` expect an Export-PDF button
   that the code deliberately hides from leads. Likely a catalog correction,
   not a code change — confirm the intended lead capability first.
   Routes: `/reports/[reportId]`, `/lead/report/[reportId]/preview`.

## Open Questions

- Finding 4: is the lead preview supposed to show the unified report or only
  the lead's section? (Blocks any fix.)
- Finding 5: should leads have Export-PDF at all? If no, the fix is in the
  driver catalog, not the app.

## Out of Scope

- head / admin / viewer driver findings — separate follow-up run after the
  weekly-limit reset.
