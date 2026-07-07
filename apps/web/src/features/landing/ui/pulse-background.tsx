/**
 * Static background for the landing left column.
 *
 * Two layers, GPU-friendly, 0 JS, 0 motion:
 *  1. Gradient base — deeper at the bottom (radial darken), warmer
 *     toward the top-right (see `.pulse-bg` in pulse.css).
 *  2. Dot grid — subtle 32px radial-gradient pattern, masked to a soft
 *     center vignette so the corners breathe.
 */
export function PulseBackground() {
  return (
    <div className="pulse-bg" aria-hidden="true">
      <div className="pulse-bg-dots" />
    </div>
  );
}
