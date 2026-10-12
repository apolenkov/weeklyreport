"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { getScalarSearchParam } from "../../../shared/lib/navigation/scalar-search-param";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { AGENTATION_ENDPOINT } from "./agentation-delivery-confirmation";
import { useAgentationDeliveryStatus } from "./use-agentation-delivery-status";

// The inlined NODE_ENV check makes the bundler drop the import, so the
// development toolbar never ships in a production build.
const Agentation = dynamic(
  () =>
    process.env.NODE_ENV === "production"
      ? Promise.resolve(() => null)
      : import("agentation").then((module) => module.Agentation),
  { ssr: false },
);

export function ProductFeedbackWidget() {
  const { user } = useSession();
  const enabled = webEnv.productFeedback();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [restoreRevision, setRestoreRevision] = useState(0);
  const sessionId = getScalarSearchParam(searchParams, "agentationSession");
  const deliveryScopeKey = `${user?.id ?? "anonymous"}:${pathname}:${sessionId ?? "new"}`;
  const delivery = useAgentationDeliveryStatus({
    authorUserId: user?.id ?? null,
    initialSessionId: sessionId,
    scopeKey: deliveryScopeKey,
  });
  const nativeSessionId = delivery.retrySessionId ?? sessionId;

  useEffect(() => {
    // A cached page can retain a disconnected native stream and stale markers.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRestoreRevision((revision) => revision + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (process.env.NODE_ENV === "production" || !enabled || user === null)
    return null;

  return (
    <>
      <Agentation
        copyToClipboard
        endpoint={AGENTATION_ENDPOINT}
        key={`${deliveryScopeKey}:${restoreRevision}:${delivery.retryRevision}`}
        onAnnotationAdd={delivery.onAnnotationAdd}
        onAnnotationDelete={delivery.onAnnotationDelete}
        onAnnotationsClear={delivery.onAnnotationsClear}
        onSessionCreated={(createdSessionId) =>
          delivery.onSessionCreated(createdSessionId, delivery.retryRevision)
        }
        {...(nativeSessionId ? { sessionId: nativeSessionId } : {})}
      />
      {delivery.unconfirmed ? (
        <Alert
          className="fixed right-6 bottom-24 z-[2147483646] w-[min(24rem,calc(100vw-3rem))] shadow-lg"
          variant="destructive"
        >
          <AlertTitle>Feedback status unknown</AlertTitle>
          <AlertDescription>
            <p>
              Could not confirm that feedback was saved. Your annotation is
              still here.
            </p>
            <Button
              disabled={!delivery.canRetry || delivery.retrying}
              size="sm"
              variant="outline"
              onClick={delivery.retry}
            >
              {delivery.retrying ? "Checking…" : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
