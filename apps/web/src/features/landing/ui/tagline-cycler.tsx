/**
 * Dynamic tagline cycler on the landing hero.
 *
 * Driven by React state + setTimeout chain (deterministic cleanup,
 * no setInterval anti-pattern).
 *
 * Rotation schedule: 3 s visible → 250 ms fade-out → swap → 250 ms fade-in.
 * On mount, picks a random start index so repeat visits feel fresh.
 *
 * TODO(i18n-future): move phrases to locale dictionary when i18n lands.
 */
"use client";

import { useEffect, useRef, useState } from "react";

import { LANDING_TAGLINES } from "./landing-page.constants";

const VISIBLE_MS = 3000;
const FADE_MS = 250;

function randomIndex(): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- tagline rotation start index for UX variety, not cryptography
  return Math.floor(Math.random() * LANDING_TAGLINES.length);
}

export function TaglineCycler() {
  const [index, setIndex] = useState<number>(randomIndex);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function cycle() {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % LANDING_TAGLINES.length);
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
