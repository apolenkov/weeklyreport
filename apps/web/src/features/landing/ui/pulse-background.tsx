// Visual lives entirely in `.pulse-bg` / pulse.css (static gradient + dots).
export function PulseBackground() {
  return (
    <div className="pulse-bg" aria-hidden="true">
      <div className="pulse-bg-dots" />
    </div>
  );
}
