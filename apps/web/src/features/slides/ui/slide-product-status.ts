import type { TrafficLightStatus } from "@weeklyreport/shared";
import type { LucideIcon } from "lucide-react";

import {
  statusIcon,
  statusLabel,
} from "../../../shared/lib/status/status-presentation";

interface SlideProductStatusPresentation {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly stripeClassName: string;
}

export const SLIDE_PRODUCT_STATUS_PRESENTATION = {
  green: {
    Icon: statusIcon("on-track", "product"),
    label: statusLabel("on-track", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-chip-on-track-border)]",
  },
  yellow: {
    Icon: statusIcon("at-risk", "product"),
    label: statusLabel("at-risk", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-status-dot-at-risk)]",
  },
  red: {
    Icon: statusIcon("blocked", "product"),
    label: statusLabel("blocked", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-destructive)]",
  },
} as const satisfies Record<TrafficLightStatus, SlideProductStatusPresentation>;
