/**
 * UFB-058 / Phase 58: «Your PULSE» display lettering.
 *
 * Two composed glyphs:
 *  - .pulse-word "YOUR"   — subdued caps, sets the eyeline
 *  - .pulse-strong "PULSE" — Fraunces variable, breathing wght, with the
 *                            ECG line passing under it as a baseline
 *                            heartbeat trace (see pulse-background)
 *
 * Brand decision (2026-05-11): the `?` glyph was dropped — the mark
 * reads stronger as an assertion («Your PULSE is here») than as a
 * question. The ECG line moved from passing-through-`?` to running
 * underneath PULSE as a baseline pulse trace.
 *
 * All motion is CSS keyframes — no JS, no Framer Motion, no setInterval.
 * `prefers-reduced-motion` disables everything.
 */
export function PulseMark() {
  return (
    <div className="pulse-mark" role="img" aria-label="Your PULSE">
      <span className="pulse-word" aria-hidden="true">
        YOUR
      </span>
      <span className="pulse-line">
        <span className="pulse-strong" aria-hidden="true">
          PULSE
        </span>
      </span>
    </div>
  );
}
