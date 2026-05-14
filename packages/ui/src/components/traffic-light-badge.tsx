import { cn } from "@customreport/ui/lib/utils";
import { Badge } from "@customreport/ui/components/ui/badge";

export type TrafficLightStatus = "green" | "yellow" | "red" | "unset";

type TrafficLightBadgeProps = {
  status: TrafficLightStatus;
  label?: string;
  className?: string;
};

const colorMap: Record<TrafficLightStatus, string> = {
  green:
    "bg-[var(--color-traffic-green)] text-[var(--color-traffic-green-foreground)] border-[var(--color-traffic-green-border)]",
  yellow:
    "bg-[var(--color-traffic-yellow)] text-[var(--color-traffic-yellow-foreground)] border-[var(--color-traffic-yellow-border)]",
  red: "bg-[var(--color-traffic-red)] text-[var(--color-traffic-red-foreground)] border-[var(--color-traffic-red-border)]",
  unset:
    "bg-[var(--color-traffic-unset)] text-[var(--color-traffic-unset-foreground)] border-[var(--color-traffic-unset-border)]",
};

const dotColorMap: Record<TrafficLightStatus, string> = {
  green: "bg-[var(--color-traffic-green-foreground)]",
  yellow: "bg-[var(--color-traffic-yellow-foreground)]",
  red: "bg-[var(--color-traffic-red-foreground)]",
  unset: "bg-[var(--color-traffic-unset-foreground)]",
};

const defaultLabels: Record<TrafficLightStatus, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
  unset: "No Status",
};

export function TrafficLightBadge({
  status,
  label,
  className,
}: TrafficLightBadgeProps) {
  const displayLabel = label ?? defaultLabels[status];

  return (
    <Badge variant="outline" className={cn(colorMap[status], className)}>
      <span
        className={cn("inline-block h-2 w-2 rounded-full", dotColorMap[status])}
        aria-hidden="true"
      />
      {displayLabel}
    </Badge>
  );
}
