"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";

type Props = Readonly<{ children: ReactNode; fallback?: ReactNode }>;
type State = { hasError: boolean; error: Error | null };

export class QueryErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    toast.error(error.message ?? "Something went wrong loading this page.");
    console.error("[QueryErrorBoundary]", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-semibold">We hit an error.</p>
            <p className="mt-1">
              {this.state.error?.message ?? "Reload to try again."}
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
