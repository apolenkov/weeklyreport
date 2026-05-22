<!-- markdownlint-disable MD013 -->

# Roadmap — Lead UI working-app verification + fix plan (2026-05-22)

peo-plan roadmap consolidating live verification, UAT findings, research, and a
prioritised fix plan for the lead interface. Built after a session that fixed
the root cause (stale dev server) plus several real bugs.

## 0. TL;DR

### Было

```text
+--- состояние до сессии --------------------------------+
| dev-сервер протух (next dev с 20 мая) → отдавал мёртвый |
|   Webpack-бандл; страница лида падала "No QueryClient"  |
| priorityRank не сохранялся (автосейв ронял поле)        |
| db:wipe:manual-uat падал (F1 удалил Priority)           |
| dashboard без кнопки Revoke; нет bulk Revoke All        |
| пользователь видел «старое/серое/не сохраняется»        |
+--------------------------------------------------------+
```

### Проблема

```text
[протухший dev-сервер] → [юзер видит старый бандл] → ложные UAT-баги
[autosave ронял priorityRank] → приоритет не доходил до БД → не сохранялся
[F1 drop Priority] → wipe-скрипт звал tx.priority → краш
[browser-tooling] → agent-browser screenshot-демон сломан; Playwright MCP
  агент буксовал на повторном dev-login → полный авто-свип не сошёлся
```

### Станет

```text
было                              │  станет
──────────────────────────────────│──────────────────────────────────
протухший сервер, краш страницы    │  свежий pnpm dev:watch, рендер 52KB ✓
priorityRank не сохранялся         │  персистится (секция приоритетов = "2") ✓
db:wipe падал                      │  exit 0, reseed ок ✓
нет dashboard revoke               │  per-lead Revoke + Revoke All (P6/P7) ✓
ручной UAT вслепую                 │  CLI+Playwright проверка + роадмапа ✓
```

### Пайплайн

```text
[done] root+bugs ──[W1] verify-finish ──[W2] visual fixes ──[W3] sweep+research
 9 commits          dialog repop/chip     skeleton/layout      remaining roles
```

## 1. Verification results (CLI + Playwright MCP, live, fresh server)

| Check                                         | Result        | Evidence                                                                 |
| --------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| Lead page renders (no SSR crash)              | ✓ PASS        | curl authed → 52613 bytes, 0× "No QueryClient"                           |
| Stale-server root cause                       | ✓ FIXED       | killed stale next/pnpm dev, `rm -rf apps/web/.next`, relaunched          |
| priorityRank persists across reload           | ✓ PASS        | Playwright: after reload, priorities section shows "2", count 7          |
| priorityRank dialog re-populate on reopen     | ⚠ SUSPECT     | agent saw empty field on immediate reopen — verify (timing vs read-path) |
| locked stage chip colour (Борис С / Planning) | ⚠ UNCONFIRMED | was likely stale-server grey; needs final live confirm on fresh build    |
| db:wipe:manual-uat                            | ✓ PASS        | exits 0, reseed + activeReport intact                                    |
| dashboard Revoke / Revoke All                 | ✓ BUILT       | P6/P7 committed; live click pending                                      |

## 2. UAT findings (this session)

- ▲ **priorityRank not saving** → ROOT-FIXED (`c55b89c`): autosave payload +
  `makeItemsChangeHandler` both dropped the field in `lead-form.tsx`. Verified persists.
- ▲ **App showed stale code / grey** → ROOT-FIXED: stale `next dev` bundle; restarted.
- ▼ **priorityRank dialog field empty on reopen** (suspected): `ItemEditDialog`
  reads `item?.priorityRank` — confirm the reloaded `data.currentWeekItems`
  carries priorityRank into the bound item (read path), not just the priorities-derived view.
- ▼ **Priorities ordering/visibility** (#3 from user) — likely resolved by the
  save fix; confirm items show P{N} chip + the derived section orders by rank.
- ◻ **layout jump / skeleton load** (user #1) — needs the multi-role visual sweep
  (W3) with throttling to measure CLS and skeleton→content transition.
- ◻ **head/admin/viewer screens** — not yet swept (browser tooling stalled).

## 3. Research — best practices (2026-05)

- **Next.js dev stale bundle**: long-running `next dev` + HMR desync is a known
  failure; mitigation is a clean `.next` + restart. Roadmap: add a `pnpm dev:fresh`
  script (`rm -rf apps/web/.next && pnpm dev:watch`) and document in README so UAT
  always runs on fresh code (matches the repo's existing "restart before UAT" rule).
- **Layout shift (CLS)**: reserve space for async content (skeleton must match
  final dimensions); measure with Lighthouse/Chrome DevTools MCP CLS trace.
- **Skeleton loading (React 19 / Suspense)**: ensure the `LeadFormSkeleton`
  fallback matches the loaded layout box to avoid jump (the page already uses
  `<Suspense fallback={<LeadFormSkeleton/>}>`).
- **Read-path symmetry**: when a write field is added (priorityRank), assert the
  READ mapper returns it too — add a contract/e2e test (the audit's "bug = two
  fixes" rule). Roadmap W1.

Existing solutions evaluated: browser UAT — reuse Playwright MCP / chrome-devtools
MCP (installed) over custom scripts; the agent-browser screenshot daemon is broken
(file a fix separately). No new tooling to build.

## 4. Fix waves

### DONE (9 commits, fix/PRJ-2/shiny-eagle)

`15acc83` wipe regression · `438ed67` audit tool · `f931ba2` dispatch+activity24h ·
`20b9dd7` revoke-downstream e2e · `e75fe6e` deactivate e2e · `cb4d652` email-Mailpit ·
`c55b89c` priorityRank persist · `da6b391`/`83614a8` plan+goal · `134d9e0` revoke P6/P7.

### W1 — finish lead verification (next, small)

- [ ] Confirm priorityRank dialog re-populate: check read path
      `lead-form` `data.currentWeekItems` → KanbanItem carries `priorityRank`
      (`leadForm.byPeriod` web mapper). Add e2e assertion (reopen after reload).
- [ ] Confirm locked stage chip colour on fresh build (Борис С / Planning) —
      if still grey, trace `stage-chip.tsx` cross-author status colour path.
- [ ] Add `pnpm dev:fresh` script + README note.

### W2 — visual (after W3 sweep confirms)

- [ ] Skeleton↔content dimension match (no jump) on lead report.
- [ ] Any spacing/contrast/overflow from the sweep.

### W3 — full multi-role sweep (Playwright MCP, fresh agent)

- [ ] head /dashboard (verify Revoke buttons live), /report, /history
- [ ] admin /admin all tabs · viewer /reports, /reports/history
- [ ] Write `.planning/audits/uat-findings-2026-05-22.md`, then fix per severity.

## 5. Execution model (used + planned)

Parallel subagents (Haiku scan / Sonnet impl) already used this session: 3 build
agents (revoke, dispatch, deactivate) + 1 email + browser verifiers. W1-W3 continue
the same: Sonnet for fixes, browser agent (Playwright MCP) for sweep, orchestrator
commits atomically. Browser tooling note: prefer Playwright MCP; agent-browser
screenshot daemon is currently broken.

## Open questions

| #   | Question                                   | Default                                                        |
| --- | ------------------------------------------ | -------------------------------------------------------------- |
| 1   | Build `pnpm dev:fresh` helper?             | Yes (W1)                                                       |
| 2   | Is dialog-empty a real read bug or timing? | CONFIRMED read bug — fixed (mapLeadItems dropped priorityRank) |

## Update log

- 2026-05-22: W1 dialog-empty resolved — `mapLeadItems` read path now carries `priorityRank`.
