# Head slides: lead-deck parity (declutter the just-shipped carousel)

## Problem

The head status deck (`?mode=slides`) shipped its carousel
(`head-slides-carousel-fullscreen`, now archived and live in
`head-slide-density`), but the 2026-06-23 live demo found it still diverges
from the lead deck. The umbrella feedback (S1): "при переходе в slides лейаут
не должен особо меняться, как у лидов" — the head slides layout must mirror
the lead-slides chrome, with the lead report toolbar / `head-report-shell`
slides-mode header as the reference. Four concrete divergences remain:

- **S2** The deck renders its own heading band — the `<h1>` "Group Status
  Slides", the subtitle "Group deck ordered by review risk before
  publishing.", and the inline "Open focused report" link — directly above
  the carousel. In slides mode `head-report-shell.tsx` already renders a
  page header (`Status Report` + the department context label) plus the
  bordered toolbar, so the deck band duplicates the report title. The user:
  "появилась эта строка, дублирует [шапку], её вообще не должно быть. Вообще."
- **S3** The "Open focused report" action sits inside the deck body instead
  of the top report toolbar / header line where the lead deck keeps its
  toolbar actions. The user: "должна быть сверху, как у лидов, кнопочки".
- **S6** The inert `AgentReviewComingSoon` placeholder occupies a fixed slot
  in the slide header instead of the toolbar's period-controls row where the
  head form mode (and the lead deck) host it. The user: "зачем-то здесь
  оказалось; должна быть в строке где периоды кликаем, как у лидов".
- **S5** The `ReadinessStrip` ("Slide completion …" score + checklist) renders
  inside the active slide. The lead deck has no such strip, and in the demo it
  is always 100% — an empty signal. The user: "непонятно, что это, для чего".

The user explicitly praised the carousel placement (**S4**) — that stays.

## Solution

Bring the head deck chrome to lead-deck parity by stripping the deck's own
heading band and relocating its actions to the report toolbar / header line
that `head-report-shell.tsx` already renders, and by removing the head-only
readiness strip:

1. **No deck heading band (S2).** The head slides deck renders no standalone
   title/subtitle band. The report shell header (`Status Report` + context
   label) is the single title. Stop passing the head `title` / `subtitle`
   into the deck chrome and stop rendering the deck's own `<header>` heading
   band for the head surface.
2. **Open focused report → toolbar (S3).** The "Open focused report" action
   moves to the top report toolbar / slides-mode header line in
   `head-report-shell.tsx`, beside the existing Export-PDF document action,
   like the lead deck keeps its toolbar actions. It is no longer rendered
   inside the deck body.
3. **Agent review → toolbar period-controls row (S6).** The inert
   `AgentReviewComingSoon` placeholder leaves the slide header and joins the
   report toolbar's context-control row in slides mode, leading the
   right-aligned view-control group like it already does in head form mode.
   The `mode === "form"` gate that today mounts it only in form mode (it was
   gated to avoid double-mounting against the in-slide slot) extends to slides
   mode once the slide-header slot is gone.
4. **Remove the readiness strip (S5).** The `ReadinessStrip` is removed
   entirely from the active head slide. The lead deck has no readiness strip,
   and in the demo the head signal is always 100% (an empty signal). The
   per-slide readiness/score model is no longer rendered as deck chrome.
5. **Lead-parity umbrella (S1).** The net result reads like the lead-slides
   layout: no extra heading band, toolbar-hosted actions, no head-only side
   chrome. The lead report toolbar / `head-report-shell` slides header is the
   reference.

This change SUPERSEDES two requirements the just-archived
`head-slides-carousel-fullscreen` added to `head-slide-density`:

- "Readiness folds into the active slide" — REMOVED (S5 reverses it; the
  strip is removed, not relocated).
- "The Agent review placeholder occupies a fixed slide-header slot" — REMOVED
  here (S6 relocates the placeholder to the toolbar, where
  `head-toolbar-semantics` already governs it).

## Non-goals

- Building any real Agent-review behavior (Phase 54 AI/RAG) — only the inert
  placeholder is relocated; the hover "is there anything for me" behavior
  stays deferred.
- Touching the carousel placement (S4, user-praised) or the requirements
  "The head deck navigates via a top carousel", "Slide status renders exactly
  once per slide", "The active head slide fills the viewport like the lead
  deck".
- Touching the lead deck (`lead-slide-quadrants` / `LeadUnifiedSlide`) — this
  change only brings the HEAD deck chrome to parity.
- The head-dashboard declutter (`head-dashboard-declutter`), the flagged-red
  escalation dedup (`fix-flagged-red-escalation-dedup`), and the accordion
  redesign research track — those are sibling changes from the same demo.

## Source

Live demo feedback, 2026-06-23, recorded in
`docs/demo-feedback-2026-06-23-head-surfaces.md` (part C, S1–S6; section
"ЗАФИКСИРОВАННЫЕ РЕШЕНИЯ", "Change 2 — head-slides-lead-parity"). Builds
directly on the just-archived `head-slides-carousel-fullscreen`. The lead
report toolbar / `head-report-shell` slides-mode header is the parity
reference.

## Activation trigger

(Active — user-directed declutter of a confusing live surface, S1–S3, S5, S6.)
