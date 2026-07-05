/**
 * Landing hero wordmark — «Weekly Report».
 *
 * Two composed tiers:
 *  - .pulse-word "WEEKLY"   — subdued caps eyebrow, sets the eyeline
 *  - .pulse-strong "REPORT" — Fraunces variable display word, static
 *
 * History: this mark previously read «Your PULSE» with a breathing
 * wordmark and an ECG heartbeat trace (Phase 58 / UFB-058). The
 * decorative pulse motif was dropped 2026-06-23 — the landing now names
 * the artifact (the weekly report), with no motion. The component/file
 * names keep the `pulse-` prefix to stay surgical; only the rendered
 * text changed.
 */
export function PulseMark() {
  return (
    <div className="pulse-mark" role="img" aria-label="Weekly Report">
      <span className="pulse-word" aria-hidden="true">
        WEEKLY
      </span>
      <span className="pulse-line">
        <span className="pulse-strong" aria-hidden="true">
          REPORT
        </span>
      </span>
    </div>
  );
}
