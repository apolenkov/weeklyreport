/**
 * UFB-058 / Phase 58: static tagline under the PulseMark.
 *
 * Original design used a 3-phrase CSS-only cycler. The math on three
 * non-overlapping phrases sharing one 12s keyframe never converged
 * cleanly without either: (a) a flash of empty text at t=0, or (b) JS
 * state for index swap. Pure-CSS solution failed UAT screenshot;
 * dropped in favor of one strong assertion line. The ECG line under
 * PULSE in PulseBackground already supplies the motion.
 *
 * TODO(UFB-062-cycling): if/when product wants the multi-phrase
 * carousel back, drive it with React state + setTimeout chain
 * (legitimate, with useEffect cleanup — not the setInterval
 * anti-pattern) so timing is deterministic. The CLAUDE.md TODO
 * discipline rule applies — add a metric
 * `customreport_landing_tagline_view_total{phrase}` to see which
 * phrase audiences see most.
 *
 * TODO(i18n-future): the TAGLINE string is the only hardcoded UI
 * copy on the landing page. When i18n is introduced, move to the
 * locale dictionary and read via the i18n hook. DB-sourced content
 * (Organization names, report text) may be Russian, but UI strings
 * stay English until i18n lands.
 */

// UFB-062: dropped "weekly" — landing copy must stay cadence-neutral
// once AppSettings.periodCadence can be 'bi-weekly' (and, future,
// 'monthly'). The motion under PULSE already implies a recurring beat.
const TAGLINE = "Your portfolio's pulse, distilled.";

export function TaglineCycler() {
  return (
    <p className="pulse-tagline-static" role="text">
      {TAGLINE}
    </p>
  );
}
