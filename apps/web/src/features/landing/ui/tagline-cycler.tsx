"use client";

import { useEffect, useRef, useState } from "react";

import { LANDING_TAGLINES } from "./landing-page.constants";

// Timing policy for the tagline rotation — exported so tests drive the
// cycler through the same constants the component uses.
export const TAGLINE_VISIBLE_MS = 3000;
export const TAGLINE_FADE_MS = 250;

function randomIndex(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value % LANDING_TAGLINES.length;
}

const nextTaglineIndex = (i: number): number =>
  (i + 1) % LANDING_TAGLINES.length;

// setTimeout chain instead of setInterval: each tick re-arms itself, so at
// any instant exactly one timer is live and cleanup is a single clearTimeout.
function CyclingTagline() {
  const [index, setIndex] = useState<number>(randomIndex);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function cycle() {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setIndex(nextTaglineIndex);
        setVisible(true);
        timerRef.current = setTimeout(cycle, TAGLINE_VISIBLE_MS);
      }, TAGLINE_FADE_MS);
    }

    timerRef.current = setTimeout(cycle, TAGLINE_VISIBLE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <p
      className="pulse-tagline"
      data-visible={visible}
      style={{
        transitionDuration: `${TAGLINE_FADE_MS}ms`,
      }}
      suppressHydrationWarning
    >
      {LANDING_TAGLINES[index]}
    </p>
  );
}

// Spec landing-page-hero, "Tagline array is empty": a misconfigured empty
// array must omit the tagline element entirely, not render an empty <p>.
export function TaglineCycler() {
  if (LANDING_TAGLINES.length === 0) return null;
  return <CyclingTagline />;
}
