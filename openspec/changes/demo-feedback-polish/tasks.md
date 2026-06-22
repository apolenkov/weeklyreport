# Tasks — demo feedback polish

## 1. Head draft visibility (items 6 + 4)

- [ ] 1.1 Relax the empty-state gate in `weekly-report-page.tsx` (~line 547) so
      the head sees draft content; show the empty state only when content is truly
      empty (no section has data), not when `submitted === 0`.
- [ ] 1.2 Keep `canPublish` gated at `submitted > 0`; ensure the "Nothing to
      publish" label and `showPublishHint` key off the publish precondition, not the
      empty screen. Relabel the now-misleading strings: the status-line hint
      "No submitted report content yet." (`weekly-report-page.tsx` ~line 466) and
      `publishDisabledReason` (~line 517) MUST read as a publish precondition
      (e.g. "Publish requires at least one submitted section."), not as
      absence-of-content.
- [ ] 1.5 Define "truly empty" for the empty state as no item/risk/decision
      across sections (reuse `hasExpandableProducts` or equivalent), never
      `submitted === 0`.
- [ ] 1.3 Leave the API content query and the viewer service gate unchanged.
- [ ] 1.4 Test: head + 0 submitted with drafts renders content; empty state only
      on truly-empty content; viewer unpublished still rejected.

## 2. View-mode toggle (item 7)

- [ ] 2.1 Pass `mode={mode === "slides" ? "slides" : "edit"}` into `ViewModeToggle`
      in `head-report-shell.tsx`.
- [ ] 2.2 Encode `scope` and `includeArchive` in the URL (currently local
      `useState`); restore them on load.
- [ ] 2.3 Test: active segment matches URL mode; refresh / shared link restore
      mode + scope.

## 3. Pipeline tooltip color (item 9)

- [ ] 3.1 Thread `hiddenStagesEffectiveStatuses` (`StageStatus[]`) into
      `CollapsedStagesIndicator` alongside the reveal lines.
- [ ] 3.2 Color each row via `STATUS_CONFIG[status].text` + a leading status dot
      (blocked/at-risk/on-track/neutral); no new token; keep the light popover surface.
- [ ] 3.3 Test: mixed-status reveal rows carry the right token colors.

## 4. Summary clip (item 1) — conformance bug, no spec delta

- [ ] 4.1 The own/Summary scope renders `LeadUnifiedSlide` (`lead-slides-client.tsx`,
      `scope === "own"`). Fix the in-page (non-fullscreen) render so its quadrants
      honor `overflow-y:auto` + `min-h-0` (the same rule `lead-slide-quadrants`
      already mandates for the fullscreen quadrants) instead of clipping the last row.
- [ ] 4.2 Regression test: an overflowing own-scope section scrolls and the last
      row is fully visible (not clipped). This restores conformance with
      `lead-slide-quadrants`; no new spec capability is added (Codex Act-2 Q5).

## 5. Gates

- [ ] 5.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate demo-feedback-polish --strict`.
