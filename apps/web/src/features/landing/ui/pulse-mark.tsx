/**
 * Landing hero wordmark — «Weekly Report».
 *
 * Two composed tiers:
 *  - .pulse-word "WEEKLY"   — subdued caps eyebrow, sets the eyeline
 *  - .pulse-strong "REPORT" — Fraunces variable display word, static
 *
 * The component/file names keep the `pulse-` prefix even though the mark
 * renders «Weekly Report», not a pulse motif.
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
