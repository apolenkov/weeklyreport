# Feature Landscape: CustomReport v6.0

**Domain:** Internal weekly status reporting tool — adding 7 feature areas to existing app
**Researched:** 2026-04-26
**Supersedes for new themes:** v5.0 FEATURES.md (production integration; superseded only for the A-G themes below — earlier table-stakes features remain valid)
**Overall confidence:** HIGH for A/B/E/F/G (well-known internal-tool patterns), MEDIUM for C/D (depend on AI-SPEC and analytics product decisions)

---

## Context: What v6.0 Is About

v5.0 made the prototype real (tRPC end-to-end, PDF pipeline, integration tests). It shipped in **admin-only mode**: every authenticated user gets head-level access for regression testing. The role guards on tRPC procedures are stubbed.

v6.0 closes that auth debt, stabilises the integration suite, and adds four product-facing increments (AI insights, trend analytics, email reminders, mobile polish) plus a release-day checklist. **Existing features (lead form, head dashboard, PDF export, archive, admin CRUD, carry-over) are NOT in scope** — they're already shipped per `.planning/PROJECT.md` Validated section.

Six themes (A/C/D/E/F/G) are user-visible product surface; one (B) is pure tech-debt cleanup.

---

# Theme A — Auth & Roles

**One-liner:** Switch from "everyone is admin" to real Keycloak SAML SSO with four roles (lead / head / admin / viewer) enforced on every API call and reflected in every UI affordance.

## A — Table Stakes

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **AUTH-01** | Real Keycloak SAML flow | `/auth/login` redirects to Keycloak; on assertion success, JWT cookie set; replaces `AUTH_DEV_MODE=true` and `NEXT_PUBLIC_AUTH_STUB=true`. Logout invalidates session both locally and at IdP (SLO). |
| **AUTH-02** | Four-role separation in JWT claims | JWT carries `role: 'lead' \| 'head' \| 'admin' \| 'viewer'` (admin is operational, head is product-owning role per PROJECT.md). Role is sourced from Keycloak group membership, not stored in our DB. |
| **AUTH-03** | RBAC on every tRPC procedure | Each of the 36 procedures declares required role(s) via a `protectedProcedure(role)` wrapper. Lead procedures additionally check `authorId === ctx.user.id` (a lead can only edit their own section). Default-deny: any procedure without an explicit role list returns 403. |
| **AUTH-04** | Role-aware UI hiding | Navigation, action buttons, and entire pages render conditionally on role. Examples: lead never sees `/admin`; viewer never sees Submit/Publish buttons; head sees everything except admin user-management. Hidden ≠ secured — backend enforces; UI hides only for ergonomics. |
| **AUTH-05** | Cookie injection in BullMQ pdf-export | The `TODO(Phase 24)` seam in `pdf-export.processor.ts` becomes real: when Playwright opens the print page, it carries the head's auth cookie so server-side rendering can fetch role-protected data. Job payload includes `requestedByUserId` + signed short-lived token (not the raw cookie — token mints a one-shot session for the headless browser). |
| **AUTH-06** | 401/403 handling end-to-end | tRPC `unauthorized` → redirect to `/auth/login`; tRPC `forbidden` → "Access denied" page (don't leak which roles would have worked). Existing 401 interceptor (v5.0) is extended with 403 branch. |
| **AUTH-07** | Session expiry + silent refresh | JWT 1h expiry, refresh token 7 days. Silent refresh on 401 before user notices. On refresh failure, soft-redirect to login with `next=` parameter (already sanitised against open-redirect per v5.0). |
| **AUTH-08** | Audit log of role-effecting events | Append-only log of: login success/failure, logout, role-elevation attempts (403 hits), publish/revoke, admin CRUD on users/projects. Required for an internal corporate app; minimum is structured JSON via existing nestjs-cls logger with a dedicated `audit.*` namespace flushed to a separate file. |

## A — Differentiators

| ID stub | Feature | One-line UX | Why differentiator (not table stakes) |
|---------|---------|-------------|---------------------------------------|
| **AUTH-09** | "Login as" / impersonation for admins | Admin can act as another user for support; banner shows "Impersonating X — exit". | Useful for triage but only one admin role exists; manual `psql` is the cheaper backup. |
| **AUTH-10** | Per-section co-ownership (lead delegates) | Lead Polenkov can grant Maria K. write access on his section while on vacation. | Real organisational need but solvable today by changing `authorId`; needs UI + audit only if vacations become frequent. |

## A — Anti-Features (do NOT build)

| Anti-feature | Why avoid | What to do instead |
|--------------|-----------|--------------------|
| **Delegated admin** (multiple admins managing subsets of users/projects) | 6 leads + 1 head + handful of operational admins. Permission matrix overhead exceeds value. | Single `admin` role; if the company grows, revisit. |
| **Self-service role request** ("request head access" UI) | Roles come from Keycloak groups; users must talk to the IdP team. Building a request flow we can't honour is theatre. | Documentation that says "ask your Keycloak admin". |
| **Custom user CRUD beyond what exists** | Users come from Keycloak; our DB stores only `samlId + email + name + cached role`. | Auto-provision on first login; admin UI shows users but does not create them in our DB primarily. |
| **MFA in our app** | Keycloak handles MFA at the IdP. | Configure MFA enforcement in Keycloak realm. |
| **Password reset flow** | Keycloak. | n/a |

## A — Dependencies

- **A is foundational for v6.0.** C, D, and E all need real role-aware data filtering.
- C → A: smart "on-track" judgement must respect viewer scope (a viewer should not see a lead's draft annotations).
- E → A: email reminder targeting depends on `User.role === 'lead'` and the canonical email source.
- D → A only weakly: trend analytics is mostly read-only on published data.

---

# Theme B — Quality Polish (pure tech-debt, no research needed)

**One-liner:** Three known-scope mechanical fixes; no UX surface.

## B — Sub-fixes (known scope)

| ID stub | Fix | Source | Dependency |
|---------|-----|--------|------------|
| **QA-01** | Single root cause of 5 integration-suite Playwright failures (tRPC POST assertion timeouts at runtime; Phase 26 first-run on 2026-04-26 produced 8/21 pass + 5 fail + 8 skip per HANDOFF.md / commit cc1a0ec) | `.planning/quick/260426-vxp-.../260426-vxp-SUMMARY.md` | None — this is the entry point. Fix unlocks the integration suite as a real CI gate. |
| **QA-02** | Add `prisma generate` postinstall hook to `apps/api/package.json` | Discovered during v5.0 onboarding — fresh `pnpm install` on a new machine fails because the Prisma Client binary isn't generated until first dev-server boot | None |
| **QA-03** | Delete dead `apps/web/src/proxy.ts` | Phase 21 moved auth proxy logic; the file is orphaned. Confirm via grep no imports reference it. | None |

**Important clarification (per advisor reconcile):** the `weekly-report-page.test.tsx` 5-test mock fix is **already CLOSED** in commit d394832 (2026-04-26, see HANDOFF.md). Don't include it as a v6.0 item. The 5 *remaining* failures are at the integration-suite layer (real API + real DB), not Vitest unit mocks.

## B — Anti-features

- Don't refactor the proxy infrastructure while removing dead `proxy.ts`. Surgical delete only.
- Don't add new tests in B; that's a different theme. B closes existing red.
- Don't auto-run integration suite on every commit until QA-01 is green and stable for ≥3 consecutive runs (flaky-by-default poisons trust in CI).

---

# Theme C — AI Features

**One-liner:** Augment the head's review surface with three AI-derived signals — auto-summary, risk sentiment, smart on-track judgement — never replacing human writing.

> **AI-SPEC required.** Per PROJECT.md, theme C goes through `/gsd-ai-integration-phase` for an AI-SPEC.md before planning. The features below define product UX; model selection, prompt design, cost/latency targets, and PII boundary belong in AI-SPEC.

## C — Table Stakes

| ID stub | Feature | One-line UX | UI placement |
|---------|---------|-------------|--------------|
| **AI-01** | Auto-summary of weekly assembled report | A 2-3 sentence executive summary card appears at the top of the head's assembled-report view. Card has Regenerate and Dismiss buttons. The summary is scoped to the current period's data only. | `head/report` (assembled) — above the human-written narrative, never *in* it. |
| **AI-02** | Risk sentiment badge | Each Risk row in the assembled report (and on the head's risks rollup) gets a small badge: `low / medium / high` derived from the risk text + impact + mitigation fields. Badge has hover tooltip explaining "AI assessment — verify before escalating". | `head/report` and `head/dashboard` risk panels — leftmost or rightmost cell of each Risk row. |
| **AI-03** | Smart "on-track" judgement annotation on traffic-light cells | Each ProjectStatus traffic-light cell shows the lead's chosen colour (green/yellow/red) AND a small advisory icon if AI disagrees with the lead's choice (e.g., risks + blocked items + 2 carry-overs but lead set green → "AI suggests review"). Click icon → tooltip with rationale. | `head/dashboard` portfolio grid — overlay icon on each cell; the cell's primary colour stays driven by the lead's input. |

## C — Differentiators

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **AI-04** | Period-over-period diff narrative | "Compared to last week: 1 project moved green→yellow; 2 risks resolved; 1 new blocker." Generated narrative card on `head/dashboard`. |
| **AI-05** | Risk theme clustering | "3 risks this week relate to capacity; 2 to vendor delays." Tag cloud at top of risks panel. |
| **AI-06** | Auto-draft for the head's narrative (lead-side equivalent: never) | Head clicks "Draft from sections" → AI seeds the head-written summary textarea with a starting point. Head edits or discards. Never appears for leads. |

## C — Anti-Features (explicit)

| Anti-feature | Why avoid |
|--------------|-----------|
| **AI replaces the human-written summary** | The assembled report is a product the head signs off on. Auto-summary is a *separate, dismissible card*. The human narrative textarea is never auto-filled by AI without an explicit "Draft from sections" click (AI-06, differentiator only) and even then it goes into a staging area, never overwriting existing text. |
| **AI fills the lead's textarea** | Leads write what they observed. AI cannot observe their week. |
| **AI changes traffic-light colour** | Read-only annotation only; the lead owns the colour. |
| **Sentiment as escalation trigger** | Sentiment is advisory; never auto-emails the head, never auto-flags. Theme E's reminders are deterministic (deadline-based), not AI-driven. |
| **External data exfiltration of risk text** | Risk text contains internal sensitive content. AI-SPEC must specify whether the model is on-prem, hosted, or hybrid; cost-vs-confidentiality is a phase-0 decision before any feature ships. |

## C — Dependencies

- **C → A:** smart judgement and summary must respect role scope (viewer sees only published data; head sees draft + submitted; lead sees only their own section). Without A, AI features would leak draft content across roles.
- **C → AI-SPEC:** model, prompt, and cost decisions block planning.

---

# Theme D — Trend Analytics

**One-liner:** Surface how the portfolio has moved over the last N periods so the head can spot drifting projects and chronic risks.

## D — Table Stakes

| ID stub | Feature | One-line UX | UI placement |
|---------|---------|-------------|--------------|
| **ANAL-01** | Per-project sparkline of last N periods' traffic light | Each project card on `head/dashboard` and on `reports/[reportId]` shows a 6-12 dot sparkline (one dot per period, coloured green/yellow/red). Hover → period label + status. | Embedded inline in existing project cells. |
| **ANAL-02** | Stacked bar of green/yellow/red counts over time | A single chart at the top of a new `/reports/trends` page: x-axis = periods, y-axis = number of projects, three stacked bars per period. | New page: `/reports/trends` (head + viewer access). |
| **ANAL-03** | Period-over-period delta table | Table: project, previous status, current status, delta arrow. Filter "only changed". | `/reports/trends` page below the stacked bar. |
| **ANAL-04** | Carry-over rate per lead | Bar chart: lead → % of items carried from previous week. Surfaces chronic over-commit. | `/reports/trends` page. |

## D — Differentiators

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **ANAL-05** | Risk recurrence detection | "This risk text has appeared in 3 of the last 4 reports for project X." Annotation on Risk rows in trends view. |
| **ANAL-06** | Velocity per lead (items completed / items planned over time) | Line chart on trends page. |
| **ANAL-07** | Export trends to CSV | Download button next to each chart. |

## D — Anti-Features

| Anti-feature | Why avoid |
|--------------|-----------|
| **Real-time dashboards** | Reports are weekly. Refreshing more than once per day is misleading. |
| **Drilldown into individual items as analytics** | Item-level analytics encourages micromanagement. Aggregate at project + lead level. |
| **Custom dashboard builder** | Out of scope for an internal 6-lead app. Pre-built views only. |
| **Cross-departmental comparison** | App is CoreDev-only. Comparing to other departments requires data we don't have. |

## D — Dependencies

- **D is largely independent.** Trends operate on historical *published* reports, which are immutable.
- Mild coupling to A: viewer access to `/reports/trends` uses role guards; head sees draft-aware deltas only if explicitly enabled (default: published-only for everyone, including head).
- Both surfaces (embedded sparkline + standalone page) ship together — the embedded view drives discovery of the standalone page.

---

# Theme E — Email Reminders

**One-liner:** Wire the existing BullMQ scheduling glue to send weekly deadline reminders and one escalation if a lead misses the deadline.

> **Most logic exists.** Per PROJECT.md, "carry-over logic + email reminder INFRASTRUCTURE" already shipped in v1.0-v2.0. v6.0 adds the *scheduling glue and templates* that turn infra into a working feature.

## E — Table Stakes

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **NOTIF-01** | Pre-deadline reminder (T-24h before period deadline) | Each lead with a non-submitted section receives one email 24h before deadline. Subject: "Your weekly status section closes tomorrow". Body: link to `/lead/report` + summary of what's pending (sections / risks / priorities not filled). |
| **NOTIF-02** | Deadline-passed escalation to head | If a lead has not submitted by deadline + 2h, head receives one digest email listing all delinquent leads. |
| **NOTIF-03** | Plaintext + HTML template parity | Both formats; HTML matches the Starbucks design system (cream/teal/gold). Templates live in `apps/api/src/notifications/templates/` as `.hbs` or `.html` files. |
| **NOTIF-04** | Per-user opt-out for the pre-deadline reminder | Admin UI toggle on user record: "Send pre-deadline reminders". Default ON. Escalation to head (NOTIF-02) is *not* opt-outable — it's an organisational control. |
| **NOTIF-05** | Idempotent delivery (one email per period per type) | BullMQ job key includes `(periodId, userId, kind)`; re-running the scheduler does not double-send. |
| **NOTIF-06** | Failed-send DLQ + admin visibility | BullMQ DLQ already exists (v2.0). Admin UI gets a small "Failed notifications (N)" badge linking to a list with retry button. |

## E — Differentiators

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **NOTIF-07** | Custom reminder schedule per lead | Some leads want T-48h; admin can override per user. |
| **NOTIF-08** | Slack/Teams webhook fallback if SMTP fails | Out of scope per PROJECT.md ("only email for v1") — keep flagged as anti-feature unless explicitly requested. |

## E — Anti-Features

| Anti-feature | Why avoid |
|--------------|-----------|
| **Multiple reminders ("nag mode")** | Email fatigue; one pre-deadline + one post-deadline is the documented norm. |
| **Reminder for the head** | Head reviews after submission; no submission deadline applies. Head sees the escalation digest only. |
| **Escalation to director** | Out of scope. Head decides whether to forward. |
| **Telegram / Slack** | PROJECT.md "Out of Scope" list. |
| **Per-section partial-fill nudges** | "You filled risks but not priorities" → too granular, intrusive. |

## E — Dependencies

- **E → A:** reminder targeting reads `User.role === 'lead'` from JWT/DB; opt-out flag lives on the user record managed via A's admin UI.
- **E → existing BullMQ infra (already shipped):** scheduler, DLQ, retry logic. v6.0 only adds template + cron + the "deadline math" helper.
- **E → existing SMTP config:** `.env` already has SMTP vars per v2.0.

---

# Theme F — Mobile Polish

**One-liner:** All 7 existing pages render usably on a phone; one of them (lead/report) becomes touch-pleasant.

## F — The 7 pages (from HANDOFF.md / regression scenarios)

1. `lead/report` — section fill form (most complex; long forms, status chips, risk dialogs)
2. `lead/history` — lead's past sections list
3. `head/dashboard` — KPI grid + portfolio table (widest table — biggest mobile risk)
4. `head/report` — assembled report review (long scroll, sections collapsible)
5. `admin` — 6-tab CRUD (table-heavy)
6. `reports/[reportId]` — published report detail (read-only, mostly OK)
7. `reports/history` — archive list (table)

## F — Table Stakes ("it works at all on a phone")

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **MOB-01** | No horizontal scroll on any of the 7 pages at 375px width | Tables collapse to card layout below 768px breakpoint; long form rows stack. |
| **MOB-02** | Tap targets ≥ 44px on all interactive elements | Status chip clicks, button presses, table row affordances meet WCAG 2.5.5. |
| **MOB-03** | `head/dashboard` portfolio grid is readable on mobile | Either horizontal scroll within a sticky-header container, or per-project card list at narrow widths. Decision: card list (matches mockup conventions for internal tools). |
| **MOB-04** | `lead/report` form is single-column at narrow widths | Side-panel risk editor (currently a side panel on desktop) becomes a full-screen dialog on mobile. |
| **MOB-05** | Admin tab navigation works on mobile | Tabs become a select dropdown below 640px; underlying CRUD tables follow MOB-01. |
| **MOB-06** | PDF preview embed is replaced by "Open PDF" button on mobile | iOS Safari can't render embedded PDFs reliably. Use direct download link. |
| **MOB-07** | Top app shell (logo + role + logout) collapses to hamburger | Standard mobile navigation pattern. |

## F — Differentiators

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **MOB-08** | Touch-optimised swipe to expand/collapse sections on `head/report` | Swipe a section header to expand. |
| **MOB-09** | Pull-to-refresh on dashboard | Standard mobile gesture. |
| **MOB-10** | "Add to Home Screen" PWA manifest | One-line config; gives leads a home-screen icon for quick deadline access. |

## F — Anti-Features

| Anti-feature | Why avoid |
|--------------|-----------|
| **Native iOS/Android app** | PROJECT.md "web-first"; Out of Scope. |
| **Mobile-first redesign** | Desktop is the primary surface (head reviews on a laptop). Mobile is for leads to fill quick updates. |
| **Offline mode** | Reports require fresh server state; partial-offline draft would conflict with autosave. |
| **Touch-only gestures with no keyboard fallback** | Some users use mobile + bluetooth keyboard. Every swipe must have a button equivalent. |

## F — Dependencies

- **F is independent.** No blockers from A/B/C/D/E.
- Should ship after A (so role-conditional UI is final before mobile-styling it).

---

# Theme G — Release Checklist

**One-liner:** Convert the ad-hoc HANDOFF #2/#3 manual smoke list into a versioned, commit-able `CHECKLIST.md` template.

## G — Format conventions

| Convention | Detail |
|-----------|--------|
| File path | `.planning/CHECKLIST.md` (template) + `.planning/milestones/v{N}-CHECKLIST.md` (per-release filled copy) |
| Format | Markdown checkbox list (`- [ ] item`) |
| Header frontmatter | `release:`, `date:`, `signoff:` (head's name), `executor:` (who ran the smoke), `evidence_dir:` (link to screenshots/recordings) |
| Section grouping | (1) Pre-deploy infra checks, (2) Auth smoke per role, (3) Lead journey, (4) Head journey, (5) PDF export, (6) Email reminders, (7) Mobile spot-check, (8) Post-deploy DB integrity |
| Item shape | `- [ ] CHECK-ID short description (expected outcome) → evidence: <link>` |
| Signoff line | At the end: `Signed off by: __________ on ____-__-__` (committed empty in template; filled in milestone copy) |
| Linkage | Each CHECK-ID maps 1:1 to an existing REGRESSION-TEST-SCENARIOS.md ID where possible (e.g., `AUTH-001`, `LEAD-001`) so failed checks are immediately traceable. |

## G — Table Stakes

| ID stub | Feature | One-line UX |
|---------|---------|-------------|
| **REL-01** | `CHECKLIST.md` template lives in `.planning/` | Versioned with the repo; PR-reviewable. |
| **REL-02** | Per-milestone fill-in is committed at release tag | `git tag v6.0` is preceded by `git add .planning/milestones/v6.0-CHECKLIST.md`. |
| **REL-03** | Each item references a regression scenario ID | Cross-link enforced by lint script (optional, but the convention is mandatory). |
| **REL-04** | Date stamp + signoff line | Forces explicit human ownership; not auto-generated. |
| **REL-05** | Evidence directory convention | `.planning/milestones/v{N}-evidence/` for screenshots/recordings. Gitignore the heavyweight contents; commit a manifest. |

## G — Anti-Features

| Anti-feature | Why avoid |
|--------------|-----------|
| **Auto-generated checklists from code coverage** | The point is *human verification* of paths a machine can't judge (UI feel, PDF readability). |
| **Checklist as CI gate** | Manual smoke is by definition manual; gating CI on a markdown checkbox is theatre. |
| **Multi-stage approval workflow (PR-style review of checklist itself)** | Single signoff is enough for an internal tool. |

## G — Dependencies

- **G is post-everything.** It documents the verification plan for A-F.

---

# Cross-Theme Dependency Map

```
A (Auth & roles)  ──────► C (AI features need role-scoped data)
                  ──────► E (Notifications need role + email)
                  ──────► F (mobile UI conditionalizes on role)
B (Quality)       ── independent ── (but blocks running integration suite as CI gate)
C (AI)            ── depends on A and on AI-SPEC
D (Trends)        ── largely independent (reads published data)
E (Email)         ── depends on A; uses existing BullMQ infra
F (Mobile)        ── independent; best after A so role-conditional UI is final
G (Checklist)     ── post-everything (documents verification of A-F)
```

**Recommended ordering for roadmap:** B → A → (E ∥ D ∥ F) → C → G.
Rationale: B unblocks the integration suite as a CI gate before bigger changes land; A is the foundation; E/D/F can run in parallel after A; C is gated on AI-SPEC and benefits from finalised roles; G closes the milestone.

---

# MVP Recommendation (if scope must be cut)

If only one slice ships in v6.0:
1. **B (must)** — finishes v5.0 tech debt; cheap.
2. **A (must)** — turns admin-only mode into a real product.
3. **E (must)** — small effort, big perceived value; infra exists.
4. **F (should)** — leads will use mobile to skim deadlines.

Defer:
- **C** — needs AI-SPEC; defer if AI-SPEC isn't ready.
- **D** — defer if A+B+E+F consumes the milestone budget.
- **G** — could move to v6.1 if needed; everything else doesn't *block* on it.

---

# Confidence Assessment

| Area | Confidence | Why |
|------|-----------|-----|
| A | HIGH | Standard SaaS internal-tool pattern; Keycloak SAML well-documented; existing seam in pdf-export.processor.ts is concrete. |
| B | HIGH | Three known fixes with explicit pointers (HANDOFF.md, commit cc1a0ec). |
| C | MEDIUM | UX is well-defined; viability depends on AI-SPEC decisions (model, on-prem vs hosted, cost). |
| D | MEDIUM-HIGH | Chart types are standard; only open question is sparkline-vs-bar density at 12 periods of history. |
| E | HIGH | Infra exists; only template + cron + opt-out flag are net-new. |
| F | HIGH | Standard responsive patterns; complexity is in `head/dashboard` table only. |
| G | HIGH | Pure documentation. |

# Sources

- `.planning/PROJECT.md` (validated requirements, current milestone scope, role definitions, out-of-scope list)
- `HANDOFF.md` (v5.0 tech debt, integration test status, environment setup, v6.0 candidate list)
- `.planning/STATE.md` (current milestone position, accumulated decisions)
- `.planning/REGRESSION-TEST-SCENARIOS.md` (existing scenario IDs for cross-linking in REL-03)
- `.planning/research/FEATURES.md` (v5.0 — supersedes inheritance for the seven new themes only)
- `apps/api/src/.../pdf-export.processor.ts` (referenced as the cookie-injection seam for AUTH-05 — known via HANDOFF.md, not re-read)
