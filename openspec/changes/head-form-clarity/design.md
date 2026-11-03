# Design

## Context

See [proposal.md](proposal.md) for scope and the complete source-review location. The log has 200 lines and was read in full. Findings are proposals based on static inspection, not observed runtime defects. CodeGraph was used for navigation; the worktree's files were read to verify the indexed results. The initial working tree was clean. No recent archive files are present in this checkout; current specs and installed OpenSpec templates supply the format.

Observed owners:

- `apps/web/src/features/report-sections/ui/activity/activity-status-strip.tsx` converts typed records into strings, retaining unavailable-parent records but dropping their detail and review anchors.
- `apps/web/src/features/report-pages/ui/product/accordion-sections.tsx` and `accordion-rows.tsx` already render typed Product rows through `ReviewedRow` with risk problem/impact/mitigation and ID-based comment anchors.
- `apps/web/src/features/report-pages/ui/weekly/weekly-report-content.tsx` filters Activities but renders them before the section toolbar; `weekly-report-page-content.tsx` owns Leads groups and the top verdict surface.
- `apps/web/src/features/review/ui/review-verdict-band.tsx` owns the roster; `section-verdict-control.tsx` owns canonical verdict actions. Section identity/version/capability come from the existing review model.
- `apps/web/src/features/dashboard/ui/lead-queue-actions.tsx` uses the same URL for Open and Review; `use-weekly-report-page.ts` initializes Read locally.
- Lead `status-overview-item-icons.tsx` uses alarm amber for pause; Head `accordion-tokens.ts` uses muted pause. The health vocabulary and item-progress vocabulary are deliberately separate.
- `head-report-chrome.tsx` supplies Edit through `ViewModeToggle` and hardcodes Live portfolio review. Existing lifecycle badge selection is correct and remains unchanged.

## Goals / Non-Goals

**Goals:** preserve the unit of review (record and owning section), make Review navigation truthful, and remove semantic inconsistencies without inventing a new authoring or persistence path.

**Non-goals:** no full Lead timeline migration, new Previous column, copying private paused reasons into broader read models, expanded review entitlement, frozen snapshot enrichment, lifecycle recoloring, new dependencies or backend changes. All implementation tasks below are future work; this delivery changes only this OpenSpec directory.

## Решено за владельца

- **Activities: compact, initially collapsed typed details** — сохраняет обзорность и раскрывает весь материал для решения без переноса редакторов Lead.
- **Leads: один verdict у заголовка секции; Product: один roster с переходом в Leads** — решение относится к авторской секции целиком, а не к отдельному продукту.
- **Activity-only sections входят в Leads наравне с Product sections** — отсутствие продукта не должно лишать автора адресуемого ревью.
- **Review URL: `review=1`, очередь добавляет `scope=lead`** — отделяет намерение ревью от существующего параметра представления `mode=slides`.
- **Open остаётся Read + Submitted; draft раскрывается только через Show all** — сохраняет действующий контракт видимости, не расширяя пять пунктов.
- **Недоступный Review: Read и краткое уведомление; другой период сбрасывает intent** — устаревшая ссылка не выдаёт полномочий и не переносит намерение на другой отчёт.
- **Paused: нейтральный `--color-muted-foreground`, подпись `Paused`** — пауза обозначает прогресс, а не риск; формы получают одну семантику.
- **Head: `Report / Slides`, detail `Portfolio report`; lifecycle badge без изменений** — названия не обещают редактирование или live-источник и не ломают Live/Published/Archived.

## Decisions

### 1. Preserve typed Activity data and reuse record review

Replace string lists with a focused Activity projection under `features/report-sections/model/` retaining report-section ID, author identity, Activity identity, complete record objects and capabilities. Keep `ActivityStatusStrip` as the public owner and extract a small Activity-record component beside it. Reuse Product row primitives and `ReviewedRow` through an appropriate public feature boundary rather than copying comment state or importing Lead editors. Move reusable row presentation to `features/report-sections/ui/records/` if needed to avoid a report-sections → report-pages dependency; keep Product wrappers thin.

The projection uses selected authorized `ReportSectionReadModel` data only. Item progress is derived by the existing progress rules; Activity-level risk flooring remains existing Activity health, never a made-up Product/stage relation. Include priority, next commitment, resolution and outcome history when already present. Risks preserve severity, problem, impact and mitigation; decisions preserve their text and original anchor. No missing snapshot field is fetched from mutable live data. Keep comments Review-only, matching Product behavior, including existing draft preservation across Read/Review and scope changes.

Product scope renders one Activity contribution per section/Activity after the section controls, independent of linked Products. Leads scope places that author's Activities inside the same anchored section as their Products; remove the external strip in this scope to avoid duplication. Extend lead grouping to the union of visible Product and Activity contributors, including unavailable Activity details. Summaries/disclosures expose current/next/risk/decision counts and an accessible author-specific control. Full weekly title, description and note remain readable.

Unavailable parents retain the current `Activity details unavailable` grouping by section; do not synthesize missing name/status. Stable original record IDs, not list indices or text, key rows and comment drafts. Same Activity with multiple authors means distinct section contributions, not a cross-author merged review unit.

**Alternative:** copying Lead Overview/editor was rejected: it introduces predecessor and authoring semantics outside Head's review contract. Merely adding a tooltip to string lists cannot restore record identity or comments.

### 2. Co-locate verdicts without duplicate action state

Pass the existing section review rows/context into the Leads composition. Render `SectionVerdictControl` once beside the owning section heading, outside accordion/disclosure content so it is reachable when cards are collapsed. Its target is the entire section, not a Product or Activity. Keep section ID, judged version, capability, mutation callback, request-changes reason dialog and pending handling in their current owners.

In Product scope keep `ReviewVerdictBand`, one control per eligible section, but turn its author name into an addressed Leads navigation link. It sets scope/author and uses the section-owned focus mechanism. Leads scope omits the top band entirely. Use `report-lead-<authorId>` for the one mounted author region; match only visible, submission-filtered content and respect reduced motion. If Request changes un-submits the last visible section, use a surviving section/Sections region as focus fallback only when the removed control held focus; never steal focus from another control. Acknowledge stays beside Publish and remains no publish prerequisite.

**Alternative:** controls under every Product or Activity would duplicate section verdicts and imply record-level approval. A sticky global verdict panel preserves the original distance and requires more mobile layout work.

### 3. Address Review explicitly and fail closed

Before: queue Open/Review → same author URL → local Read initializer → manual Review toggle.

After: queue Review → `authorId=<id>&scope=lead&review=1` → scalar query parsing → current report/section capability check → effective Review → owning section focus. Open → existing author URL → Read + Submitted. Neither path writes anything.

Thread the parsed intent from `app/(app)/head/report/[reportId]/page.tsx` through `HeadReportShell`, weekly-page props and its existing mode owner. Extend the shared scalar copy contract for `review`; duplicate keys, including two equal values, are invalid. Use URL-backed Read/Review selection rather than an initializer that ignores subsequent navigation. Loading never temporarily exposes controls. Intent cannot override section submission, archived/published state, current entitlement or server write gates. A targeted ineligible author cannot borrow another author's capability.

Read removes the parameter; eligible Review sets it. Browser history restores intent; refresh rechecks it. Same-report scope/archive filter and Report/Slides links preserve intent and author; the existing period URL builder explicitly deletes `review` when changing report ID. Slides never interprets intent as a write surface. Invalid scalar input silently uses Read; valid but unavailable intent shows the exact English notice defined in the routing delta without disclosing foreign author metadata. Do not automatically switch Submitted to All.

**Alternative:** `mode=review` conflicts with the form/slides axis; globally defaulting to Review changes ordinary report entry. A one-shot consumed marker makes refresh and back behavior less predictable than explicit URL state.

### 4. Separate pause progress from alarm health

Add a small shared item-progress presentation definition in `shared/lib/status/` used by Lead's progress glyph and Head's badge/rail token lookup. It defines pause label and foreground once: `Paused`, `--color-muted-foreground`. It does not add `paused` to `CanonicalStatus`, duplicate the health map, recolor at-risk, or change stored statuses. Other progress presentation remains untouched. Existing named CSS tokens suffice; no new color literal or design token is required. Preserve slide dashed-frame/no-glyph semantics and all print output.

**Alternative:** making Head pause amber would preserve the Lead appearance but confuse paused work with a risk alarm. A new pause palette would add unnecessary MVP visual vocabulary.

### 5. Correct Head chrome without changing shared consumers

Use the existing read-only Report presentation of `ViewModeToggle` for the Head chrome (or an equivalently narrow semantic input), rather than changing its shared default. Both Read and Review are interactions inside Report, not editing of report content. Use `Portfolio report` for department detail in form and Slides. Preserve actual lifecycle text/ratio and all action eligibility; no Live → Draft rename. Audit accessible names, tooltips, mobile icon-only labels and desktop text together.

`report-toolbar-layout` and `ui-control-density` contain literal Edit wording, so their full modified blocks accompany this label change. `head-report-visibility`, `lead-status-overview`, `web-status-color-tokens` and `review-acknowledge-placement` remain compatible and require no delta.

**Alternative:** Form / Slides is accurate but less consistent with the existing Report vocabulary. Lifecycle-specific department copy duplicates the authoritative lifecycle badge.

## Risks / Trade-offs

- [Activity payload becomes accidentally flattened again] → typed projector tests assert IDs, full fields and original comment anchors, including unavailable parents and duplicate text.
- [Activity-only section missing from Leads] → grouping and page tests cover authors without Products and submitted-only filtering.
- [Navigation resets mode or replays stale intent] → tests cover duplicate parameters, loading, history, explicit Read, same-report context changes and period changes.
- [Inline verdict targets the wrong author/version] → reuse canonical controls and assert mutation section ID/version with two authors and a version conflict.
- [Disclosures hide detail by default] → show true counts and keep verdict outside details; require keyboard and 375/1280 screenshot acceptance rather than claiming static layout PASS.

## Migration Plan

No database migration, destructive operation, feature flag or API rollout is needed. Land shared presentation/record extraction with parity tests, then Activity and verdict composition, then routing and chrome. Existing bookmarks without review intent remain valid. Rollback is a Web revert; extra `review` parameters on old deployments are inert. API review transaction locks, version CAS, mandatory reasons and authorization are unchanged. Period dual-state updates, canonical middleware/leadProcedure identity, destructive guards and rollover uniqueness are preserved, not relaxed. No API-owned or published snapshot output is enriched or rewritten.

## Acceptance

Each [delta requirement](specs/) maps to a file-and-test task in [tasks.md](tasks.md). Planning acceptance is strict OpenSpec validation, changed-directory Prettier checking and whitespace checking only. Future implementation requires all six repository gates plus browser evidence at 1280 and 375 CSS pixels, including Activity-only review, keyboard focus, correct mutation anchors, draft visibility, unavailable intent, and unchanged published/archived read behavior. No runtime/browser acceptance is claimed by this planning delivery. There are no unresolved UX decisions.
