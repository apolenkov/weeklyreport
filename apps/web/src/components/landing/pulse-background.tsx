/**
 * UFB-058 / Phase 58: Living background for the landing left column.
 *
 * Three layers, all GPU-accelerated, 0 JS:
 *  1. Gradient base — replaces the old static cross pattern. Deeper at
 *     the bottom (radial darken), warmer toward the top-right.
 *  2. Dot grid — subtle 32px radial-gradient pattern, masked to a soft
 *     center vignette so the corners breathe.
 *  3. ECG SVG — two stroke-dasharray tracks (primary + secondary) that
 *     sweep across the canvas via stroke-dashoffset animation. The
 *     primary track is pinned vertically to the eyeline of PULSE in
 *     PulseMark — visually the trace passes underneath the wordmark.
 *
 * The path `d` attributes are pre-flattened single-line strings.
 * Multi-line JSX template strings caused a Next.js 16 hydration
 * mismatch: the server emitted the raw string with embedded newlines,
 * while the browser's SVG parser collapsed whitespace per the SVG
 * spec, so the two trees disagreed on the `d` attribute. Keep them on
 * one line.
 */

// Primary ECG track — clinical lead-II pattern: flat baseline → small P wave →
// tall QRS spike → T-wave bump → flat → repeat. ~12 peaks across viewBox width.
const ECG_PRIMARY_D =
  "M 0 100 L 180 100 Q 200 100 210 92 L 220 88 Q 230 92 240 100 L 280 100 L 295 96 L 305 124 L 312 40 L 320 160 L 330 96 L 345 100 L 420 100 Q 440 100 450 90 L 460 86 Q 470 90 480 100 L 560 100 L 590 100 L 605 96 L 615 124 L 622 40 L 630 160 L 640 96 L 655 100 L 760 100 Q 780 100 790 92 L 800 88 Q 810 92 820 100 L 900 100 L 915 96 L 925 124 L 932 40 L 940 160 L 950 96 L 965 100 L 1100 100 L 1115 96 L 1125 124 L 1132 40 L 1140 160 L 1150 96 L 1165 100 L 1300 100 Q 1320 100 1330 92 L 1340 88 Q 1350 92 1360 100 L 1440 100 L 1455 96 L 1465 124 L 1472 40 L 1480 160 L 1490 96 L 1505 100 L 1640 100 Q 1660 100 1670 92 L 1680 88 Q 1690 92 1700 100 L 1780 100 L 1795 96 L 1805 124 L 1812 40 L 1820 160 L 1830 96 L 1845 100 L 1980 100 L 1995 96 L 2005 124 L 2012 40 L 2020 160 L 2030 96 L 2045 100 L 2400 100";

// Secondary track — shifted lower + thinner + slower; adds depth without
// competing for attention.
const ECG_SECONDARY_D =
  "M 0 100 L 240 100 L 260 96 L 270 110 L 278 80 L 286 130 L 296 96 L 310 100 L 520 100 L 540 96 L 550 110 L 558 80 L 566 130 L 576 96 L 590 100 L 820 100 L 840 96 L 850 110 L 858 80 L 866 130 L 876 96 L 890 100 L 1180 100 L 1200 96 L 1210 110 L 1218 80 L 1226 130 L 1236 96 L 1250 100 L 1520 100 L 1540 96 L 1550 110 L 1558 80 L 1566 130 L 1576 96 L 1590 100 L 1860 100 L 1880 96 L 1890 110 L 1898 80 L 1906 130 L 1916 96 L 1930 100 L 2400 100";

export function PulseBackground() {
  return (
    <div className="pulse-bg" aria-hidden="true">
      <div className="pulse-bg-dots" />
      <svg
        className="pulse-bg-ecg"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d={ECG_PRIMARY_D} />
        <path
          className="track-secondary"
          transform="translate(0,40)"
          d={ECG_SECONDARY_D}
        />
      </svg>
    </div>
  );
}
