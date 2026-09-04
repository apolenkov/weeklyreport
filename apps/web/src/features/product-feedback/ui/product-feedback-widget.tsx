"use client";

import { Agentation } from "agentation";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";

const AGENTATION_ENDPOINT = "/api/v1/agentation";

export function ProductFeedbackWidget() {
  const { user } = useSession();
  const enabled = webEnv.productFeedback();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [restoreRevision, setRestoreRevision] = useState(0);

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

  const sessionId = searchParams.get("agentationSession");

  return (
    <Agentation
      copyToClipboard
      endpoint={AGENTATION_ENDPOINT}
      key={`${pathname}:${sessionId ?? "new"}:${restoreRevision}`}
      {...(sessionId ? { sessionId } : {})}
    />
  );
}
