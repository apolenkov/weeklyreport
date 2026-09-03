// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { SitepingConfig } from "@siteping/widget";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { ProductFeedbackWidget } from "./product-feedback-widget";

const { destroy, initSiteping } = vi.hoisted(() => {
  const destroy = vi.fn();
  return {
    destroy,
    initSiteping: vi.fn((_config: SitepingConfig) => ({ destroy })),
  };
});

vi.mock("@siteping/widget", () => ({ initSiteping }));
vi.mock("../../../shared/lib/auth/session-provider", () => ({
  useSession: vi.fn(),
}));
vi.mock("../../../shared/lib/runtime/web-env", () => ({
  webEnv: { productFeedback: vi.fn() },
}));

const mockedSession = vi.mocked(useSession);
const feedbackEnabled = vi.mocked(webEnv.productFeedback);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockedSession.mockReturnValue({
    user: {
      id: "user-1",
      name: "Lead User",
      email: "lead@example.test",
      role: "lead",
    },
    organization: null,
    isLoading: false,
    isAuthenticated: true,
  });
});

describe("ProductFeedbackWidget", () => {
  it("mounts a minimized authenticated widget when explicitly enabled", () => {
    feedbackEnabled.mockReturnValue(true);
    const { unmount } = render(<ProductFeedbackWidget />);

    expect(initSiteping).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/siteping",
        projectName: "weekly-report",
        identity: { name: "Lead User", email: "lead@example.test" },
        enableScreenshot: true,
        captureDiagnostics: { console: true, network: true },
        enableRightClickComment: true,
        deepLink: true,
        minViewportWidth: 0,
      }),
    );
    unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("clears SitePing's durable retry queue before init and after errors", () => {
    feedbackEnabled.mockReturnValue(true);
    localStorage.setItem("siteping_retry_queue", "queued");
    render(<ProductFeedbackWidget />);

    expect(localStorage.getItem("siteping_retry_queue")).toBeNull();
    const config = initSiteping.mock.calls[0]?.[0];
    localStorage.setItem("siteping_retry_queue", "failed");
    config?.onError?.(new Error("submission failed"));
    expect(localStorage.getItem("siteping_retry_queue")).toBeNull();
  });

  it("moves drawing instructions away from the top navigation", async () => {
    feedbackEnabled.mockReturnValue(true);
    const toolbar = document.createElement("div");
    toolbar.dataset.sitepingIgnore = "true";
    toolbar.style.cssText =
      "position: fixed; top: 0; left: 0; right: 0; height: 52px";
    document.body.append(toolbar);
    const { unmount } = render(<ProductFeedbackWidget />);
    const config = initSiteping.mock.calls[0]?.[0];

    config?.onAnnotationStart?.();
    await Promise.resolve();
    expect(toolbar).toHaveAttribute(
      "data-weekly-report-siteping-toolbar",
      "bottom",
    );
    expect(toolbar.style.top).toBe("auto");
    expect(toolbar.style.bottom).toBe("0px");

    unmount();
    toolbar.remove();
  });

  it("sends a bounded deep-link id as a same-origin request header", () => {
    feedbackEnabled.mockReturnValue(true);
    window.history.replaceState({}, "", "/lead/report?siteping=feedback_123");
    render(<ProductFeedbackWidget />);

    const headers = initSiteping.mock.calls[0]?.[0].headers;
    expect(typeof headers).toBe("function");
    if (typeof headers !== "function") return;
    expect(headers()).toEqual({ "x-siteping-focus-id": "feedback_123" });
  });

  it("does not initialize while disabled or unauthenticated", () => {
    feedbackEnabled.mockReturnValue(false);
    const first = render(<ProductFeedbackWidget />);
    expect(initSiteping).not.toHaveBeenCalled();
    first.unmount();

    feedbackEnabled.mockReturnValue(true);
    mockedSession.mockReturnValue({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
    });
    render(<ProductFeedbackWidget />);
    expect(initSiteping).not.toHaveBeenCalled();
  });
});
