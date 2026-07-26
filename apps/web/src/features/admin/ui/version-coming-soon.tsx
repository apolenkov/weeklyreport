import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
import { History } from "lucide-react";

export function VersionComingSoonControl() {
  return (
    <ComingSoonIconButton
      icon={History}
      shape="toolbar"
      ariaLabel="Version history is coming soon"
      testId="version-coming-soon"
    />
  );
}
