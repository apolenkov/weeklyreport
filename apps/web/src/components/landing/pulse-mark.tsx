/**
 * UFB-058 / Phase 58: «Your PULSE?» display lettering.
 *
 * Three composed glyphs:
 *  - .pulse-word "YOUR"   — subdued caps, sets the eyeline
 *  - .pulse-strong "PULSE" — Fraunces variable, breathing wght
 *  - .pulse-q "?"          — gold, own breathing rhythm, with a pulsing
 *                            dot inside replacing the natural «?» dot
 *
 * The ECG track in <PulseBackground> is intentionally pinned to the
 * baseline of «PULSE?» so the trace appears to pass through the glyph
 * — that's the moment. If you re-position this component, retune
 * .pulse-bg-ecg top offset in pulse.css.
 *
 * All motion is CSS keyframes — no JS, no Framer Motion, no setInterval.
 * `prefers-reduced-motion` disables everything.
 */
export function PulseMark() {
  return (
    <div className="pulse-mark" aria-label="Your PULSE?">
      <span className="pulse-word" aria-hidden="true">
        YOUR
      </span>
      <span className="pulse-line">
        <span className="pulse-strong" aria-hidden="true">
          PULSE
        </span>
        <span className="pulse-q" aria-hidden="true">
          ?
        </span>
      </span>
    </div>
  );
}
