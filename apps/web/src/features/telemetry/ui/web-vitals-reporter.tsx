"use client";

import { useEffect } from "react";

import { reportWebVitals } from "../client";

export function WebVitalsReporter(): null {
  useEffect(() => {
    reportWebVitals();
  }, []);
  return null;
}
