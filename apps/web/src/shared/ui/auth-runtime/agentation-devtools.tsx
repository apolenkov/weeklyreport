"use client";

import dynamic from "next/dynamic";

import { webEnv } from "../../lib/runtime/web-env";

// Agentation reads browser storage while rendering. Keeping it out of SSR
// avoids a Node localStorage warning without masking the integration defect.
const AgentationClient = dynamic(
  () => import("agentation").then((module) => module.Agentation),
  { ssr: false },
);

export function AgentationDevtools() {
  // Escape hatch when `next dev` forces NODE_ENV=development outside an
  // interactive session (e.g. UI sweep). Without this the widget mounts, fails
  // to reach :4747, and injects console + a11y noise into the run.
  if (webEnv.disableDevtools()) return null;
  if (process.env.NODE_ENV !== "development") return null;
  return <AgentationClient endpoint="http://localhost:4747" />;
}
