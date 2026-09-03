"use client";

import { normalizeFeedbackPath } from "@customreport/shared";
import { initSiteping } from "@siteping/widget";
import { useEffect } from "react";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";

const SITEPING_RETRY_QUEUE_KEY = "siteping_retry_queue";
const SITEPING_RETRY_QUEUE_LOCK = "siteping_retry_queue";

function moveSitepingDrawingToolbarToBottom(): void {
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.dataset.sitepingIgnore !== "true") continue;
    if (child.hasAttribute("role")) continue;
    if (
      child.style.position !== "fixed" ||
      child.style.top !== "0px" ||
      child.style.left !== "0px" ||
      child.style.right !== "0px" ||
      child.style.height !== "52px"
    ) {
      continue;
    }
    child.style.top = "auto";
    child.style.bottom = "0px";
    child.dataset.weeklyReportSitepingToolbar = "bottom";
    return;
  }
}

function scheduleSitepingDrawingToolbarPlacement(): void {
  queueMicrotask(moveSitepingDrawingToolbarToBottom);
}

function currentFeedbackId(): string | null {
  const value = new URLSearchParams(window.location.search).get("siteping");
  return value && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : null;
}

function clearSitepingRetryQueue(): void {
  const clear = () => localStorage.removeItem(SITEPING_RETRY_QUEUE_KEY);
  clear();
  const locks = (navigator as unknown as { locks?: LockManager }).locks;
  if (locks) void locks.request(SITEPING_RETRY_QUEUE_LOCK, clear);
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

  useEffect(() => {
    if (!enabled || user === null) return;
    clearSitepingRetryQueue();
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
      locale: "en",
      theme: "auto",
      onAnnotationStart: scheduleSitepingDrawingToolbarPlacement,
      onError: clearSitepingRetryQueue,
    });
    return () => {
      clearSitepingRetryQueue();
      siteping.destroy();
    };
  }, [enabled, user]);

  return null;
}
