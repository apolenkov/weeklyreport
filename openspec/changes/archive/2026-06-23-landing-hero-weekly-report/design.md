# Design — Landing hero «Weekly Report» de-pulse

Small, scoped UI change. Recording it because it reverses the decorative
half of the Phase 58 «Your PULSE» rebrand on the landing, and a future
reader will otherwise wonder why the elaborate pulse machinery was torn
out.

## Locked decisions (grill 2026-06-23)

1. **Wordmark text — variant A.** Eyebrow `WEEKLY` + display `REPORT`,
   reusing the existing `.pulse-word` / `.pulse-strong` two-tier layout
   and the Fraunces face. Rejected variant B (single flat line) — A
   drops into the current markup without re-layout.
2. **ECG line — removed entirely**, not frozen. A static heartbeat trace
   reads as a "stopped heart"; without motion the golden zig-zag has no
   meaning, so the whole SVG layer goes.
3. **Keep the column.** Dark-green gradient, dot grid, gold hairline
   stay — the ask was "remove the animation", not "blank the panel".
4. **Keep the tagline cycler.** It is a separate fade transition, not the
   pulse; governed by the existing tagline requirements.
5. **Scope — landing only.** Right-panel «Status Reporting System» and
   the nav brand-pill are untouched. The resulting brand inconsistency
   (landing says «Weekly Report», product is still YourPulse elsewhere)
   is acknowledged and deferred, not resolved here.

## Naming note

The component/file names (`PulseMark`, `pulse-background.tsx`,
`pulse.css`, `.pulse-*` classes) are kept as-is to stay surgical — only
their rendered content/animation changes. A later rename to a
brand-neutral `BrandMark` is out of scope.

## No ADR

Considered but skipped: the decision is cheap to reverse (text + CSS),
so it fails the "hard to reverse" bar for an ADR. This design note plus
the proposal rationale are the durable record.
