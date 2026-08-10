"use client";

import { Agentation } from "agentation";

import { webEnv } from "../../lib/runtime/web-env";

export function AgentationDevtools() {
  // Escape hatch when `next dev` forces NODE_ENV=development outside an
  // interactive session (e.g. UI sweep). Without this the widget mounts, fails
  // to reach :4747, and injects console + a11y noise into the run.
  if (webEnv.disableDevtools()) return null;
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation endpoint="http://localhost:4747" />;
}
