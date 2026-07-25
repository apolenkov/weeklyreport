"use client";

import { useEffect } from "react";

import { reportWebVitals } from "../../../lib/web-vitals";

/**
 * Web Vitals Reporter.
 */
export function WebVitalsReporter(): null {
  useEffect(() => {
    reportWebVitals();
  }, []);
  return null;
}
