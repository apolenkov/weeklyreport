"use client";

import { useEffect, useRef, useState } from "react";

import { LANDING_TAGLINES } from "./landing-page.constants";

const VISIBLE_MS = 3000;
const FADE_MS = 250;

function randomIndex(): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- tagline rotation start index for UX variety, not cryptography
  return Math.floor(Math.random() * LANDING_TAGLINES.length);
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
        timerRef.current = setTimeout(cycle, VISIBLE_MS);
      }, FADE_MS);
    }

    timerRef.current = setTimeout(cycle, VISIBLE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <p
      className="pulse-tagline"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
      }}
      suppressHydrationWarning
    >
      {LANDING_TAGLINES[index]}
    </p>
  );
}

// Spec landing-page-hero, "Tagline array is empty": a misconfigured empty
// array must omit the tagline element entirely, not render an empty <p>.
/**
 * Tagline Cycler.
 */
export function TaglineCycler() {
  if (LANDING_TAGLINES.length === 0) return null;
  return <CyclingTagline />;
}
