"use client";

import { normalizeFeedbackPath } from "@customreport/shared";
import { initSiteping, registerLocale } from "@siteping/widget";
import { useEffect, useState } from "react";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { PageFeedbackDialog } from "./page-feedback-dialog";

const WEEKLY_REPORT_SITEPING_LOCALE = "weekly-report-en";

function currentFeedbackId(): string | null {
  const value = new URLSearchParams(window.location.search).get("siteping");
  return value && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : null;
}

function currentFeedbackScope(): string {
  const search = new URLSearchParams(window.location.search);
  const sitepingUrl = search.has("siteping") ? search.get("sitepingUrl") : null;
  return sitepingUrl
    ? normalizeFeedbackPath(sitepingUrl)
    : window.location.pathname;
}

export function ProductFeedbackWidget() {
  const { user } = useSession();
  const enabled = webEnv.productFeedback();
  const [annotationActive, setAnnotationActive] = useState(false);

  useEffect(() => {
    if (!enabled || user === null) return;
    registerLocale(WEEKLY_REPORT_SITEPING_LOCALE, {
      "annotator.instruction": "Drag to comment",
    });
    const siteping = initSiteping({
      endpoint: "/api/siteping",
      projectName: "weekly-report",
      headers: () => {
        const feedbackId = currentFeedbackId();
        return feedbackId ? { "x-siteping-focus-id": feedbackId } : {};
      },
      identity: { name: user.name, email: user.email },
      forceShow: true,
      minViewportWidth: 0,
      enableScreenshot: true,
      captureDiagnostics: { console: true, network: true },
      enableRightClickComment: true,
      scopeAnnotationsByUrl: true,
      watchNavigation: true,
      getPageScope: () => ({
        url: currentFeedbackScope(),
        urlPattern: null,
      }),
      deepLink: true,
      locale: WEEKLY_REPORT_SITEPING_LOCALE,
      theme: "auto",
      onAnnotationStart: () => setAnnotationActive(true),
      onAnnotationEnd: () => setAnnotationActive(false),
    });
    return () => siteping.destroy();
  }, [enabled, user]);

  return enabled && user && !annotationActive ? (
    <PageFeedbackDialog identity={{ name: user.name, email: user.email }} />
  ) : null;
}
