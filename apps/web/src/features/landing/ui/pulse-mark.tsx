// File/component keep the pulse- prefix; the mark itself reads «Weekly Report».
export function PulseMark() {
  return (
    <div className="pulse-mark" role="img" aria-label="Weekly Report">
      <span className="pulse-word" aria-hidden="true">
        WEEKLY
      </span>
      <span className="pulse-strong" aria-hidden="true">
        REPORT
      </span>
    </div>
  );
}
