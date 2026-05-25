/**
 * UFB-062: dynamic tagline cycler on the landing hero.
 *
 * Driven by React state + setTimeout chain (deterministic cleanup,
 * no setInterval anti-pattern — see UFB-058 comment history).
 *
 * Rotation schedule: 3 s visible → 250 ms fade-out → swap → 250 ms fade-in.
 * On mount, picks a random start index so repeat visits feel fresh.
 *
 * TODO(i18n-future): move phrases to locale dictionary when i18n lands.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { LANDING_TAGLINES } from "./landing-page.constants";

const VISIBLE_MS = 3_000;
const FADE_MS = 250;

function randomIndex(): number {
  return Math.floor(Math.random() * LANDING_TAGLINES.length);
}

export function TaglineCycler() {
  const [index, setIndex] = useState<number>(randomIndex);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function cycle() {
      // Fade out
      setVisible(false);
      timerRef.current = setTimeout(() => {
        // Swap phrase
        setIndex((i) => (i + 1) % LANDING_TAGLINES.length);
        // Fade in
        setVisible(true);
        // Schedule next cycle
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
      role="text"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {LANDING_TAGLINES[index]}
    </p>
  );
}
