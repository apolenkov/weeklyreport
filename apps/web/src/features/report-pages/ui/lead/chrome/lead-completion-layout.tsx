import type { ReactNode } from "react";

export function LeadCompletionLayout({
  children,
  actions,
}: {
  readonly children: ReactNode;
  readonly actions: ReactNode;
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
      {actions}
    </div>
  );
}
