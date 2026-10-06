import { Lock } from "lucide-react";

import { STAGE_ICONS, STATUS_CONFIG } from "../../model/stage-chip-config";
import { stageShortLabel } from "../../model/stage-tags";
import type { StageAssignment } from "../../model/types";

const ASSIGNEE_FONT_WEIGHT_MINE = 600;
const ASSIGNEE_FONT_WEIGHT_OTHER = 400;

function StageIconGlyph({ stageName }: { readonly stageName: string }) {
  const StageIcon = STAGE_ICONS[stageName];
  if (!StageIcon) return null;
  return (
    <StageIcon
      className="inline-block h-[12px] w-[12px] shrink-0"
      aria-hidden="true"
    />
  );
}

function LockBadge() {
  return (
    <span
      className="absolute -top-1.5 -right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--card-surface-border)] bg-[var(--color-card)]"
      aria-hidden="true"
    >
      <Lock className="h-[9px] w-[9px] text-[var(--color-muted-foreground)]" />
    </span>
  );
}

export function StageChipContent({
  stage,
  isLocked,
}: {
  readonly stage: StageAssignment;
  readonly isLocked: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2 truncate lg:gap-1.5">
        <StageIconGlyph stageName={stage.stageName} />
        <span className="min-w-0 truncate xl:hidden">
          {stageShortLabel(stage.stageName)}
        </span>
        <span className="hidden whitespace-nowrap xl:inline">
          {stage.stageName}
        </span>
      </span>
      <span
        aria-hidden="true"
        data-testid="stage-status-glyph"
        data-status={stage.status}
        className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/25 text-[11px] font-bold lg:h-4 lg:w-4 lg:text-[9px]"
      >
        {STATUS_CONFIG[stage.status].icon}
      </span>
      {isLocked && <LockBadge />}
    </>
  );
}

export function AssigneeLabel({ stage }: { readonly stage: StageAssignment }) {
  const isMine = stage.ownership === "mine";
  return (
    <span
      className="block max-w-full truncate text-xs"
      title={stage.assignee ?? "Unassigned"}
      style={{
        color: isMine
          ? "var(--color-starbucks-accent)"
          : "var(--color-muted-foreground)",
        fontWeight: isMine
          ? ASSIGNEE_FONT_WEIGHT_MINE
          : ASSIGNEE_FONT_WEIGHT_OTHER,
      }}
    >
      {stage.assignee ?? "—"}
    </span>
  );
}
