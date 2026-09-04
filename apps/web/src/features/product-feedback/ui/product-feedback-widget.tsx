"use client";

import { Agentation } from "agentation";
import { usePathname, useSearchParams } from "next/navigation";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";

const AGENTATION_ENDPOINT = "/api/v1/agentation";

export function ProductFeedbackWidget() {
  const { user } = useSession();
  const enabled = webEnv.productFeedback();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (process.env.NODE_ENV === "production" || !enabled || user === null)
    return null;

  const sessionId = searchParams.get("agentationSession");

  return (
    <Agentation
      copyToClipboard
      endpoint={AGENTATION_ENDPOINT}
      key={`${pathname}:${sessionId ?? "new"}`}
      {...(sessionId ? { sessionId } : {})}
    />
  );
}
