import {
  ClipboardList,
  FlaskConical,
  Hammer,
  Headset,
  PenTool,
  Search,
  Server,
} from "lucide-react";

import type { StageStatus } from "./types";

// The chip button and pipeline arrow wrapper share this height so their
// midlines match by construction, with or without assignee labels below.
// Value measured from the rendered chip: p-2 (8px×2) + text-xs line-height
// (~20px) ≈ 36px; round to 36px for a clean even number.
export const STAGE_CHIP_BOX_HEIGHT = "36px";

// Semantic fills and borders stay centralized in the theme tokens.
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
    border: "var(--color-border)",
  },
};

// Per-stage SDLC icons aid spatial scanning without carrying status.
export const STAGE_ICONS: Partial<Record<string, typeof ClipboardList>> = {
  Planning: ClipboardList,
  Analysis: Search,
  Design: PenTool,
  Development: Hammer,
  Testing: FlaskConical,
  DevOps: Server,
  Support: Headset,
};
