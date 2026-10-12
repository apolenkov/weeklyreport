"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  Component,
  createElement,
  type ErrorInfo,
  Fragment,
  type ReactNode,
} from "react";
import { toast } from "sonner";

type Props = Readonly<{ children: ReactNode; fallback?: ReactNode }>;
interface State {
  hasError: boolean;
}

export class QueryErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Never surface the raw exception text — a generic message keeps internals
    // out of user copy; the error still reaches the console for diagnostics.
    toast.error("The page hit an unexpected error.");
    console.error("[QueryErrorBoundary]", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return createElement(
        Fragment,
        null,
        this.props.fallback ?? (
          <div className="flex min-h-svh items-center justify-center p-6">
            <Alert variant="destructive" className="max-w-md">
              <AlertTitle>We hit an error.</AlertTitle>
              <AlertDescription>
                An unexpected error interrupted this page. Your data is safe.
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                onClick={this.reset}
                className="mt-3"
              >
                Try again
              </Button>
            </Alert>
          </div>
        ),
      );
    }
    return createElement(Fragment, null, this.props.children);
  }
}
