import type { ReactNode } from "react";

export function LeadCompletionLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div
      className="lead-completion-layout"
      data-testid="lead-completion-layout"
    >
      <div
        className="lead-completion-scrollport"
        data-testid="lead-completion-scrollport"
      >
        {children}
      </div>
    </div>
  );
}
