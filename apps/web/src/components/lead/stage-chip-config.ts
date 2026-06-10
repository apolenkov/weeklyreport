import {
  ClipboardList,
  FlaskConical,
  Hammer,
  Headset,
  PenTool,
  Search,
  Server,
} from "lucide-react";

import type { StageStatus } from "./mock-data";

// apply-status-palette (memo T5 opt 3): muted semantic fills via the
// --color-chip-* tokens; no hardcoded status hex in this config.
export const STATUS_CONFIG: Record<
  StageStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  "on-track": {
    icon: "✓",
    bg: "var(--color-chip-on-track-bg)",
    text: "var(--color-chip-on-track-text)",
    border: "var(--color-chip-on-track-border)",
  },
  "at-risk": {
    icon: "!",
    bg: "var(--color-chip-at-risk-bg)",
    text: "var(--color-chip-at-risk-text)",
    border: "var(--color-chip-at-risk-border)",
  },
  blocked: {
    icon: "✕",
    bg: "var(--color-chip-blocked-bg)",
    text: "var(--color-chip-blocked-text)",
    border: "var(--color-chip-blocked-border)",
  },
  empty: {
    icon: "○",
    bg: "var(--color-surface-empty)",
    text: "var(--color-muted-foreground)",
    border: "rgba(0,0,0,0.15)",
  },
};

export const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: "on-track", label: "✓ On Track" },
  { value: "at-risk", label: "! At Risk" },
  { value: "blocked", label: "✕ Blocked" },
  { value: "empty", label: "○ Clear" },
];

// apply-status-palette (memo T5): per-stage SDLC icon, keyed by stage name
// ("Dev" ↔ "Development" alias mirrors lead-form.ts). Status stays on the
// glyph/colors above; the icon only aids spatial scanning of the pipeline.
export const STAGE_ICONS: Partial<Record<string, typeof ClipboardList>> = {
  Planning: ClipboardList,
  Analysis: Search,
  Design: PenTool,
  Dev: Hammer,
  Development: Hammer,
  Testing: FlaskConical,
  DevOps: Server,
  Support: Headset,
};
