/**
 * UFB-058 / Phase 58: cycling tagline under the PulseMark.
 *
 * Three phrases share one 12s CSS animation cycle, each delayed by 4s
 * (via negative animation-delay so the first phrase is visible at
 * t=0). The reveal is a clip-path mask sweeping left → right — visually
 * echoing an ECG trace drawing the text across the screen.
 *
 * The static fallback for screen readers / reduced-motion is the first
 * phrase (see pulse.css media query).
 *
 * To change the wording, edit PHRASES below. The animation handles up
 * to 3 phrases without retuning timings; for more phrases, see
 * pulse.css keyframes pulse-tagline-cycle.
 */

const PHRASES = [
  "Корпоративный пульс продуктов",
  "Срез по группам за неделю",
  "Здоровье продуктов в одной строке",
] as const;

export function TaglineCycler() {
  const a11yLabel = PHRASES.join(" · ");

  return (
    <div
      className="pulse-tagline"
      role="text"
      aria-label={a11yLabel}
    >
      {PHRASES.map((phrase) => (
        <span key={phrase} className="pulse-tagline-phrase">
          {phrase}
        </span>
      ))}
    </div>
  );
}
