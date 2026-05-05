# Mockup vs Implementation Audit — 2026-05-05

**Mockup:** `mockups/cutom_report_maket_mockup-v17-v14.html` (slides s1–s9)
**Scope:** All implemented React screens under `apps/web/src/`

Severity legend:
- **HIGH** — visible to user, breaks visual brand consistency or functional feel
- **MEDIUM** — noticeable on side-by-side compare; quietly dilutes polish
- **LOW** — subtle, would need a designer's eye

---

## 1. Top Navigation Chrome (`components/navigation/nav-bar.tsx`)
*Affects every authenticated screen.*

### N-1 — Logo monogram is wrong [HIGH]
- **Mockup** (line 197, `.tn .lo i`): circular `var(--tealA)` badge with literal text **`CR`** in 14px Lexend bold.
- **Impl** (`nav-bar.tsx:107-109`): single letter **`C`** on `var(--color-starbucks-green)` background.
- **Fix:** change letter to `CR`, size `h-8 w-8`, ensure background is the lighter `--color-starbucks-accent` (#00754A), font 14px Lexend.

### N-2 — Active nav link uses underline; mockup uses pill [HIGH]
- **Mockup** (line 42): `.tn nav a.on{background:var(--tealL);color:var(--teal);font-weight:600}` + pill radius `var(--pill)` (50px). No underline.
- **Impl** (`nav-bar.tsx:122-133`): bottom `2px` underline span; no background pill.
- **Fix:** replace underline span with `bg-[var(--color-success)] text-[var(--color-primary)] font-semibold rounded-[var(--radius-pill)]` on `.active` link; drop the absolute span.

### N-3 — Nav links have no SVG icons [MEDIUM]
- **Mockup** (line 197): each nav link is `display:inline-flex;align-items:center;gap:5px` with a 14×14 SVG (file icon for "Report", clock for "History", grid for "Dashboard", gear for "Admin", document for "My Report").
- **Impl** (`nav-bar.tsx:117-136`): label-only, no icons.
- **Fix:** add a small `<svg>` next to each `link.label` keyed by `link.href`.

### N-4 — Right-rail period badge missing [HIGH]
- **Mockup** (line 197 `.rt`): nav right side shows `<span class="badge b-pr num">Apr 14–20 · Week 16</span>` followed by a vertical separator then user info.
- **Impl** (`nav-bar.tsx:140-152`): just role label + 1-letter avatar. No period badge.
- **Fix:** wire current period via session/store and render a `b-pr` badge before the avatar.

### N-5 — Avatar shows 1 letter; mockup shows 2 + role label [HIGH]
- **Mockup** (line 197): `<div class="av" style="background:var(--tealL);color:var(--teal)">АП</div>` (40×40 in spec; 32×32 used inline) + full name+role text `"Platanov A. · Dev Lead"`.
- **Impl** (`nav-bar.tsx:142-151`): hidden role label on small viewport, 8×8 single-character avatar (`getRoleLabel(role).charAt(0)`).
- **Fix:** compute initials from `user.fullName`; render `"{firstName} . {lastName}"` next to avatar; avatar bg `var(--color-success)`, text `var(--color-primary)`.

### N-6 — Bottom 3px teal accent under nav too thin [LOW]
- **Mockup** (line 35 `.tn::after`): `width:min(1152px,calc(100% - 48px));height:3px;background:var(--teal);border-radius:3px 3px 0 0`.
- **Impl** (`nav-bar.tsx:156-158`): `h-[2px]` and full-width radius-less.
- **Fix:** bump to `h-[3px]` and add `rounded-t`; tealA → teal (mockup uses the deeper teal here).

---

## 2. Lead Form — Page Header (`components/lead/lead-form.tsx`)

### LF-1 — Period navigator missing leading "Week" label + calendar icon mismatch [LOW]
- **Mockup** (line 215-225): no leading "Week" text; the calendar icon lives only on the *Lead Form* page navigator? Actually no — mockup has plain `< [select] >` with no leading icon at all.
- **Impl** (`period-navigator.tsx:119-125`): leading `<CalendarIcon /> Week` chip.
- **Severity:** LOW — extra affordance that doesn't actively hurt. Skip unless user wants strict parity.

### LF-2 — "Editing version" cluster is missing version chevrons + label [MEDIUM]
- **Mockup** (line 227-232): right side of context-shell shows `"Editing version"` label + previous-version `<` button + version pill `v3` + next-version `>` button.
- **Impl** (`lead-form.tsx:911-918`): renders `<VersionHistoryNav>` only — need to verify it includes the prev/next chevrons + label.
- **Fix:** confirm `VersionHistoryNav` includes all three controls; otherwise add the "Editing version" lead label.

### LF-3 — Submitted badge styling differs [LOW]
- **Mockup** (line 200, `.b-ok`): submitted-state status badge uses `b-ok` (light teal bg + dark teal text) + label "Autosaved" or specific submitted state.
- **Impl** (`lead-form.tsx:833-840`): submitted state uses `bg-[var(--color-primary)] text-white` (the `b-done` variant). Mockup uses `b-ok` for "Autosaved" and a different submitted treatment.
- **Severity:** LOW — both are valid badge styles, but mockup never shows a "Submitted" with white text on dark teal.

---

## 3. Lead Form — SDLC Pipeline / Product Cards (`components/lead/sdlc-pipeline.tsx`, `stage-chip.tsx`)

### SDLC-1 — Product header shows raw "2 blockers" string instead of pulsing dot [MEDIUM]
- **Mockup** (line 289, `.risk-dot`): inline pill with a *pulsing red dot* (`@keyframes pulse-risk`) + count + hover tooltip listing each blocker.
- **Impl** (`sdlc-pipeline.tsx:136-140`): plain `<span className="text-[11px] font-semibold text-[var(--color-destructive)]">{product.riskSummary}</span>` — no dot, no pulse, no tooltip.
- **Fix:** add `risk-dot` rendering: `<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span class="animate-pulse h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]"/> {count} blockers</span>` with hover tooltip.

### SDLC-2 — Per-stage badges in product header missing [MEDIUM]
- **Mockup** (line 291): when product has issues it renders `<span class="badge b-err">✕ Dev</span><span class="badge b-err">✕ Testing</span>` — *individual stage chips* alongside the product status.
- **Impl** (`sdlc-pipeline.tsx:142-150`): only one product-level `<ProductStatusBadge>`.
- **Severity:** MEDIUM — gives the head a one-glance read of which stages are problematic without expanding.

### SDLC-3 — Locked stage tooltip uses generic title; mockup has specific assignee-aware title [LOW]
- **Mockup** (line 248): `title="PM · No edit permissions"`, etc., with assignee name.
- **Impl** (`stage-chip.tsx:156-160`): builds `title` from `assignee` if present — appears OK, but check that `unassigned` shows `— unassigned` correctly. The label below the chip is `"— unassigned"` in both places — match.

### SDLC-4 — Empty stage assignee label color is teal accent in impl, but mockup also styles it teal — *no diff* (verified line 454 `color:var(--tealA)`).

---

## 4. Lead Form — Current Week / Next Week Items

### KB-1 — Item card border-color mismatch on dashed Next-Week cards [MEDIUM]
- **Mockup** (line 162): `.kb-card{border:1px solid var(--ceramic);…;border-left:3px solid var(--tealA)}`. Next-week override (line 581): `style="border-style:dashed"` — but the *3px tealA left strip remains solid* in the mockup because `border-style:dashed` only applies to the 1px sides; left is overridden to `3px solid var(--tealA)` by the `.kb-card` selector. Wait — the inline `border-style:dashed` overrides ALL sides; the left becomes `3px dashed var(--tealA)`.
- **Impl** (`item-card.tsx:111-113`): for `isPlanned` it sets `borderLeft: '1px dashed var(--color-muted)'` (1px, not 3px, and color is muted gray, not tealA).
- **Severity:** MEDIUM — the mockup planned card still has a *3px dashed left strip in tealA*, giving it the same visual width as current-week cards. The impl turns it into a thin gray dashed line, breaking column alignment.
- **Fix:** `borderLeft: '3px dashed var(--color-starbucks-accent)'` for `isPlanned`.

### KB-2 — Edit/Delete actions are 8×8 in impl, mockup is 32×32 [MEDIUM]
- **Mockup** (line 169): `.kb-card .kb-actions button{width:32px;height:32px;…}`.
- **Impl** (`item-card.tsx:120-137`): `h-8 w-8` (32×32 — matches!) inside each button. **No diff.** *(strike — already matches)*

### KB-3 — Action buttons show at 30% opacity by default in mockup [LOW]
- **Mockup** (line 166-167): `.kb-card .kb-actions{opacity:.3} .kb-card:hover .kb-actions{opacity:1}`.
- **Impl** (`item-card.tsx:120`): `opacity-0 group-hover:opacity-100` — fully hidden until hover.
- **Severity:** LOW — design decision; the 30% baseline is more discoverable on touch but reads as broken on hi-DPI desktops. Document as intentional or revert.

### KB-4 — Blocked-card background is full red wash; OK [MEDIUM] *(half-done)*
- Verified: mockup `.kb-card.blocked{background:#fee2e2}` matches impl `background: '#fee2e2'`.

### KB-5 — "+ Add" button styling [LOW]
- **Mockup** (line 100/175): `.kb-add{background:rgba(0,117,74,.08);color:var(--teal);border-color:rgba(0,117,74,.18);font-size:12px;padding:6px 12px;min-height:34px}` — but the later `.kb-add` rule overrides to `padding:3px 10px;min-height:44px;font-size:11px;border-radius:var(--pill)`.
- **Impl** (`next-week-section.tsx:151-159`): `min-h-[28px] … py-0.5 … text-[11px]` — min-height is 28 not 44; ok visually but breaks 44px tap target rule.
- **Fix:** bump to `min-h-[44px]`.

### KB-6 — Next Week column headers are gray text but mockup uses muted-gray + small "stage" annotation [LOW]
- **Mockup** (line 533): `<div class="area mb-0" style="font-size:12px">Data Analytics Suite · <span style="color:var(--tealA);text-transform:none;letter-spacing:0;font-weight:400">Testing</span></div>` — adds the user's stage in tealA, lowercase, no letter-spacing.
- **Impl** (`next-week-section.tsx:148-150`): just `col.productName`, no stage annotation.
- **Severity:** LOW — informational; helps the lead see "this column = my Testing work for X". Matches CurrentWeek's grouping.

---

## 5. Lead Form — Risks Section

### RSK-1 — Card uses Risk / Impact / Mitigation grid; mockup uses single textarea [MEDIUM, structural]
- **Mockup** (line 614-622): each risk is a single bordered card with one inline `<textarea class="inp" rows="2">…full text…</textarea>` + delete button.
- **Impl** (`risks-section.tsx:160-179`): renders three labeled blocks (`Risk` / `Impact` / `Mitigation`) read-only on the card; edit dialog is the only edit surface.
- **Severity:** MEDIUM — intentional richness vs. mockup brevity. If the spec mandates impact+mitigation as separate fields, keep it; otherwise the mockup is cleaner.
- **Recommendation:** confirm with user — current implementation is more correct semantically, but the visual is heavier than mockup.

### RSK-2 — At-risk card border is too pale [LOW]
- **Mockup** (line 614): `background:#fffcf5;border:1px solid rgba(212,160,23,.15)`.
- **Impl** (`risks-section.tsx:120-122`): `background: '#fffcf5'`, `border: '1px solid rgba(212,160,23,0.15)'` — **matches**.

---

## 6. Lead Form — Decisions Section

### DEC-1 — Decision card extra fields not in mockup [MEDIUM, structural]
- **Mockup** (line 650): single line — product badge + inline `<input class="inp">` for the decision text + delete button. No deadline chip, no owner chip, no impact field.
- **Impl** (`decisions-section.tsx:131-188`): product badge + optional Due chip + optional Owner chip + Decision/Owner/Impact grid.
- **Severity:** MEDIUM — also intentional structural enrichment. Same trade-off as RSK-1.

### DEC-2 — Decision background does not use `var(--canvas)` consistently [LOW]
- **Mockup** (line 650): `style="background:var(--canvas)"` (#f4f1eb).
- **Impl** (line 129): `background: 'var(--color-background)'` — verify `--color-background` resolves to `#f4f1eb`. (In `apps/web/src/app/globals.css` likely; not viewed). If not, swap to a hardcoded `#f4f1eb` or add a `--color-canvas` alias.

---

## 7. Lead Form — Priorities Section

### PRI-1 — Rank-2 visual tier wrong color [MEDIUM]
- **Mockup** (line 660-662): rank 1 uses `--goldBg` (#cba258 saturated) bg with `--goldLL` row bg; rank 2 uses **`--goldL` (#dfc49d)** badge with `--goldLL` row bg (same row tint as rank 1); rank 3+ uses `--ceramic` badge with `--canvas` row bg (lighter).
- **Impl** (`priorities-section.tsx:48-52`): rank-2 badge `#dfc49d` ✓, rank-2 row bg `#faf6ee` (mockup-equivalent of `--goldLL`) — **but applies same `#faf6ee` to ALL ranks (line 162)**. Mockup distinguishes rank 3 with `var(--canvas)` (#f4f1eb) row.
- **Fix:** in `priorities-section.tsx:162` use `style={{ background: entry.rank <= 2 ? '#faf6ee' : '#f4f1eb' }}`.

### PRI-2 — Inline-edit input replaced by button-to-open-dialog [LOW, intentional]
- **Mockup** (line 660): `<input class="inp">` directly editable in row.
- **Impl** (`priorities-section.tsx:170-182`): clickable card opens `PriorityEditDialog`.
- Comments in code call this out explicitly as a UX consistency choice. Document and skip.

---

## 8. Dashboard (`components/dashboard/*`)

### DASH-1 — KPI card section labels use uppercase tracking-wider; mockup uses sentence case [MEDIUM]
- **Mockup** (line 678): `<div class="meta mb-2">Submissions</div>` — `.meta` is `font-size:14px;color:var(--fgm)`, *no uppercase, no tracking*.
- **Impl** (`kpi-cards.tsx:20-22`): `text-xs font-medium uppercase tracking-wider`.
- **Fix:** drop `uppercase tracking-wider`, keep size `text-sm` (14px) and muted color.

### DASH-2 — KPI "Last week" shown as just text; mockup does too — match [verified].

### DASH-3 — Lead Reports card traffic-light dot for at-risk uses pastel bg [HIGH]
- **Mockup** (line 119, `.td-y`): `background:#d4a017` (saturated gold) with **white** text from `.td{color:#fff}`. Mockup also overrides per-row to `color:#fff` to ensure contrast.
- **Impl** (`lead-report-card.tsx:38`): `TRAFFIC_BG['at-risk'] = '#fef3c7'` (pastel) with text-color `#fff` — i.e. white text on pastel = invisible.
- **Fix:** change `at-risk` bg to `#d4a017` (saturated). Same for `lead-history-list.tsx:85` (which already uses `#d4a017` ✓ — only `lead-report-card.tsx` needs fixing).

### DASH-4 — Pending alert "Send Reminder" button styling differs slightly [LOW]
- **Mockup** (line 684): `style="margin-left:auto;font-size:13px;min-height:36px;padding:6px 14px"` — 36px tap target.
- **Impl** (`alert-bar.tsx:91`): `min-h-[36px] px-3.5 py-1.5 text-[13px]` — matches.

### DASH-5 — Lead Reports card lock icon missing for non-current-user rows [MEDIUM]
- **Mockup** (line 707-711): each non-current-user row ends with a small `🔒` SVG icon (lock, line 707 inline `<svg viewBox="0 0 24 24">…rect+path…</svg>` at 50% opacity).
- **Impl** (`lead-report-card.tsx:144`): renders a `<ChevronRight />` regardless of `isCurrentUser`.
- **Severity:** MEDIUM — the lock signals "this is locked for you" to lead-role users. Removing it makes both states look navigable.
- **Fix:** branch on `isCurrentUser`: render `ChevronRight` if true, lock SVG (50% opacity) otherwise. Or render lock only for `lead`-role viewers (head sees chevron).

### DASH-6 — "Lead Reports" section header label inconsistent [LOW]
- **Mockup** (line 701): section title is `"Lead Reports"` (line 700 comment says "ALL LEADS — clickable for Admin/Head").
- **Impl** (`lead-reports-grid.tsx`): need to verify; likely matches.

---

## 9. Weekly Report (`components/weekly-report/*`)

### WR-1 — Section "area" labels uppercase weight 600 vs mockup 700 + tighter tracking [LOW]
- **Mockup** (line 122 `.area`): `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--fgm)`.
- **Impl** (`product-accordion.tsx:129,161,etc`): `text-xs font-semibold uppercase tracking-wider` — that's 12px / weight 600 / tracking ~0.05em. **All three off.**
- **Fix:** make a CSS utility `.area` in globals or hardcode `text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]`.

### WR-2 — Current Week + Next Week section labels tinted black; mockup uses muted gray [MEDIUM]
- **Mockup** (line 768 area): plain gray `.area` for Current/Next Week (color from `.area` class = `var(--fgm)`).
- **Impl** (`product-accordion.tsx:129,161`): `text-[var(--color-foreground)]` (near-black).
- **Fix:** swap to `text-[var(--color-muted-foreground)]`.

### WR-3 — "Needs Attention" + "Risks & Blockers" headers in mockup are red; impl matches ✓.

### WR-4 — Decision header in mockup is `var(--tealA)`; impl uses `text-[var(--color-starbucks-accent)]` ✓.

### WR-5 — Priorities header in mockup is `var(--gold)`; impl uses `text-[var(--color-starbucks-gold)]` ✓ assuming alias maps to `#8a6d1b`.

### WR-6 — Weekly report Risks-text colors miss the dark variant on at-risk [LOW]
- **Mockup** (line 768 risk text): `color:var(--gold)` = `#8a6d1b`.
- **Impl** (`product-accordion.tsx:199`): `color: 'var(--color-starbucks-gold)'`. Verify alias.

### WR-7 — Avatar in product accordion uses 32×32 `.av` from mockup — verify [LOW]
- **Mockup** (line 768): `<div class="av" style="…;width:32px;height:32px;font-size:11px">CR</div>`.
- **Impl** (`product-accordion.tsx`): not yet viewed below line 100; assumed similar. Spot-check.

---

## 10. Admin Panel (`components/admin/*`)

### ADM-1 — Tab strip uses pill row with one active green pill; impl likely uses underline tabs [MEDIUM]
- **Mockup** (line 806): `<div class="flex gap-1 p-1 mt-4 rounded-lg" style="background:var(--white);box-shadow:var(--shadow)">` containing 5 buttons; the active one has `class="btn btn-pr"` (filled green pill), inactive `class="btn-gh"` (transparent ghost) — but with `border-radius:var(--pill)` forced on each.
- **Impl** (`admin-panel.tsx`): switches via `activeTab` prop; tab-strip rendering must be in the page component (not viewed). Spot-check `apps/web/src/app/(app)/admin/*/page.tsx`.
- **Action:** locate tab strip; ensure: rounded outer container with `bg-white shadow`, 5 pill buttons, active = `bg-[var(--color-starbucks-accent)] text-white rounded-[var(--radius-pill)]`, inactive = transparent ghost.

### ADM-2 — "+ Add Product" button label/style [LOW]
- **Mockup** (line 808): `<button class="btn btn-pr" style="font-size:13px">+ Add Product</button>`.
- **Impl:** not yet viewed. Verify `font-size:13px` (not the default `14px`).

---

## 11. Login Page (`s8` mockup → no impl found)

### LOGIN-1 — Login screen not implemented in app [HIGH, blocking]
- **Mockup** (s8, line 1086-1146): two-column layout — left: green gradient `linear-gradient(135deg,#1E3932 0%,#006241 40%,#00754A 70%,#2d8f6f 100%)` with "Demo" 56px Lexend bold, decorative circles/shapes, right: white panel with "CustomReport" 32px teal, subtitle, big SSO pill button (`min-height:52px;background:var(--tealA);box-shadow:0 2px 12px rgba(0,98,65,.2)`), Keycloak footer line, separator, dept line.
- **Impl:** no `apps/web/src/app/login/page.tsx` or sign-in page found. `auth/error/page.tsx` exists but not the SSO entry.
- **Severity:** HIGH — the user's first impression. Without it the auth flow goes straight to Keycloak with no branded waiting room.
- **Fix:** add `apps/web/src/app/login/page.tsx` (or `(auth)/sign-in/page.tsx`) implementing the two-column layout. Already-authenticated users redirect to dashboard.

---

## 12. Lead History (`components/lead/lead-history-list.tsx`, mockup s9)

### HIST-1 — History card missing `border-left:3px solid var(--tealA)` accent [MEDIUM]
- **Mockup** (line 1162): each `<a class="card p-4" style="border-left:3px solid var(--tealA)">` — submitted reports have a teal left strip.
- **Impl** (`lead-history-list.tsx:66`): standard card without left strip.
- **Fix:** add `borderLeft: '3px solid var(--color-starbucks-accent)'` to the Link's style.

### HIST-2 — History page lacks the right-rail "Reporting Overview" sidebar [MEDIUM]
- **Mockup** (line 1158-1196): two-column `.history-layout` grid — main column = report cards, right column = `<aside class="history-sidebar">` with three rail cards (Reporting Overview stats, Recent Pattern, Quick Filters).
- **Impl** (`reports/history/page.tsx`): single column, no aside.
- **Severity:** MEDIUM — sidebar makes the page feel like a working area, not just an archive. The CSS `.history-rail-card`, `.history-stat-grid`, `.history-stat` are defined in mockup but no impl uses them.
- **Fix:** add a sidebar component (or note as future scope if out of phase).

### HIST-3 — Month grouping label `April 2026` / `March 2026` missing [LOW]
- **Mockup** (line 1160, 1165): `<div class="area mt-2">April 2026</div>` etc — groups cards by month using uppercase area labels.
- **Impl** (`lead-history-list.tsx:62-107`): flat grid, no month grouping.
- **Severity:** LOW — works without it but loses temporal structure.

### HIST-4 — Card metric line shows `"6 assigned products · 11 items · 1 risk · 2 decisions"` [LOW]
- **Mockup** (line 1162): explicit count like `"6 assigned products · 11 items · 1 risk · 2 decisions"`.
- **Impl** (`lead-history-list.tsx:90-95`): three pieces (`{N} items · {N} risks · {N} decisions`) but no `"assigned products"`.
- **Fix:** add product count first.

### HIST-5 — Submitted timestamp uses calendar icon? [LOW]
- **Mockup** (line 1162): `<div class="meta mt-1" style="font-size:13px">Submitted Apr 20, 14:32</div>` — no icon, just text.
- **Impl** (`lead-history-list.tsx:99-104`): adds a `<ClockIcon />` before the text.
- **Severity:** LOW — extra affordance but mockup stays text-only.

---

## 13. Print Page (`apps/web/src/app/print/[reportId]/page.tsx`)
*Out of scope for this audit — mockup has no print-specific layout (PDF rendering).*

---

## Top 5 HIGH-severity findings (must-fix for design parity)

1. **N-1** Logo monogram is `C` not `CR` — every screen wrong.
2. **N-2** Active nav link shows underline instead of pill background — breaks brand.
3. **N-4** Period badge missing from nav right-rail.
4. **N-5** Avatar uses 1 letter; should be initials + role label.
5. **DASH-3** Lead-report card at-risk traffic light invisible (white-on-pastel).
6. **LOGIN-1** Login screen not implemented at all.

## Severity totals
- HIGH: 6
- MEDIUM: 16
- LOW: 17
- **Total findings: 39** across 13 sections.

## Suggested fix-PR slicing
1. **PR-nav** — N-1..N-6 (chrome): single component touch, immediate visual win.
2. **PR-dashboard** — DASH-1, DASH-3, DASH-5: tightens the head's daily view.
3. **PR-weekly-report-typography** — WR-1, WR-2: globals.css `.area` class + accordion text-color swaps.
4. **PR-lead-form-cards** — KB-1, KB-5, PRI-1: align card geometry with mockup.
5. **PR-history-shell** — HIST-1..HIST-3: left-strip + sidebar + month grouping.
6. **PR-login** — LOGIN-1: brand-new file, 2-column layout, mock SSO button.

## Process notes for next audit
- This audit caught only what could be inspected in the static mockup vs static React source. **Run a screenshot diff** (Playwright headless capture of each route at `1280×800`, side-by-side with the rendered mockup at same width) to surface dynamic differences (focus rings, hover states, scroll edges).
- The mockup ships its own `.area`, `.kb-card`, `.chip`, `.tn`, etc. classes. Consider porting those as a `mockup-classes.css` companion to `globals.css` so future drift is easier to spot.
