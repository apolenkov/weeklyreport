"use client";

import { Agentation } from "agentation";

import { webEnv } from "../../lib/web-env";

export function AgentationDevtools() {
  // Escape hatch for environments that run the app via `next dev` (which forces
  // NODE_ENV=development) but are NOT an interactive dev session — e.g. the
  // behavioral UI sweep. Without this the devtools widget mounts, fails to reach
  // its backend on :4747, and injects its own console + a11y noise into the run.
  if (webEnv.disableDevtools()) return null;
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation endpoint="http://localhost:4747" />;
}
