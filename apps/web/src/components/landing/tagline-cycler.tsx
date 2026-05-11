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
 *
 * TODO(i18n-future): the PHRASES array is the only hardcoded UI copy
 * on the landing page. When i18n is introduced, move these to the
 * locale dictionary (`messages/<lang>/landing.json` or similar) and
 * read via the i18n hook. The component contract stays the same — it
 * just receives a string[] from the dictionary. Metric to add on i18n
 * activation: `customreport_landing_locale_total{locale}` counter so
 * we see which audiences land here. See CLAUDE.md TODO discipline
 * rule. Until then, English-only — DB-sourced content (Organization
 * names, report text) may be Russian, but UI strings stay English.
 */

const PHRASES = [
  "Your portfolio's weekly pulse.",
  "Every group, one heartbeat.",
  "Status across products, distilled.",
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
