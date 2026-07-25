import { ComingSoonControl } from "@customreport/ui/components/coming-soon-control";
import { BotMessageSquare } from "lucide-react";

// compact strips touch-target min-height for tight slide headers.
// TODO(AGENT-REVIEW-01): mount in lead+head slide and report surfaces
export function AgentReviewComingSoon({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <ComingSoonControl
      icon={BotMessageSquare}
      label="Agent review"
      ariaLabel="Agent review is coming soon"
      testId="agent-review-coming-soon"
      compact={compact}
    />
  );
}
