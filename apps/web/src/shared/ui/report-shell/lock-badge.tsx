"use client";

import { Lock } from "lucide-react";
import { useRef } from "react";

import { useSdlcTooltip } from "../../../components/ui/sdlc-tooltip";

type LockBadgeVariant = "default" | "slim";

interface LockBadgeProps {
  readonly authorName: string | null | undefined;
  /** Default = 34×34 (matches Edit/Delete buttons); slim = 24×24 for compact cards. */
  readonly variant?: LockBadgeVariant;
}

export function LockBadge({ authorName, variant = "default" }: LockBadgeProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tooltip = useSdlcTooltip();
  const tooltipContent = `Read-only · Author: ${authorName ?? "another lead"} · You can't edit this card`;

  function handleEnter() {
    const el = ref.current;
    if (!el) return;
    tooltip.show(el.getBoundingClientRect(), tooltipContent);
  }
  function handleLeave() {
    tooltip.hide();
  }

  const sizing =
    variant === "slim"
      ? "min-h-6 min-w-6 p-1"
      : "min-h-[34px] min-w-[34px] p-1.5";
  const iconSize = variant === "slim" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      ref={ref}
      className={`flex ${sizing} cursor-default items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white text-[var(--color-muted-foreground)]`}
      role="img"
      aria-label={`Read-only — authored by ${authorName ?? "another lead"}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Lock className={iconSize} aria-hidden="true" />
    </div>
  );
}
