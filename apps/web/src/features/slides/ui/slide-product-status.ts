import type { TrafficLightStatus } from "@customreport/shared";
import {
  CircleCheck,
  type LucideIcon,
  OctagonX,
  TriangleAlert,
} from "lucide-react";

import { statusLabel } from "../../../shared/lib/status/status-presentation";

interface SlideProductStatusPresentation {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly stripeClassName: string;
}

export const SLIDE_PRODUCT_STATUS_PRESENTATION = {
  green: {
    Icon: CircleCheck,
    label: statusLabel("on-track", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-chip-on-track-border)]",
  },
  yellow: {
    Icon: TriangleAlert,
    label: statusLabel("at-risk", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-status-dot-at-risk)]",
  },
  red: {
    Icon: OctagonX,
    label: statusLabel("blocked", "print"),
    stripeClassName: "border-l-4 border-l-[var(--color-destructive)]",
  },
} as const satisfies Record<TrafficLightStatus, SlideProductStatusPresentation>;
