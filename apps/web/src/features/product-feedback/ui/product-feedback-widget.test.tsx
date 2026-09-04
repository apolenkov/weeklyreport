// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { SitepingConfig } from "@siteping/widget";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { ProductFeedbackWidget } from "./product-feedback-widget";

const { destroy, initSiteping, registerLocale } = vi.hoisted(() => {
  const destroy = vi.fn();
  return {
    destroy,
    initSiteping: vi.fn((_config: SitepingConfig) => ({ destroy })),
    registerLocale: vi.fn(),
  };
});

vi.mock("@siteping/widget", () => ({ initSiteping, registerLocale }));
vi.mock("./page-feedback-dialog", () => ({
  PageFeedbackDialog: ({ identity }: { identity: { name: string } }) => (
    <div>Page feedback for {identity.name}</div>
  ),
}));
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
        locale: "weekly-report-en",
      }),
    );
    expect(registerLocale).toHaveBeenCalledWith("weekly-report-en", {
      "annotator.instruction": "Drag to comment",
    });
    expect(screen.getByText("Page feedback for Lead User")).toBeInTheDocument();
    unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each(["lead", "viewer", "head", "admin"] as const)(
    "renders the page-comment action for authenticated %s users",
    (role) => {
      feedbackEnabled.mockReturnValue(true);
      mockedSession.mockReturnValue({
        user: {
          id: `${role}-user`,
          name: `${role} user`,
          email: `${role}@example.test`,
          role,
        },
        organization: null,
        isLoading: false,
        isAuthenticated: true,
      });

      render(<ProductFeedbackWidget />);

      expect(
        screen.getByText(`Page feedback for ${role} user`),
      ).toBeInTheDocument();
    },
  );

  it("hides the page-comment action for the annotation lifecycle", () => {
    feedbackEnabled.mockReturnValue(true);
    render(<ProductFeedbackWidget />);
    const config = initSiteping.mock.calls[0]?.[0];

    expect(screen.getByText("Page feedback for Lead User")).toBeInTheDocument();
    act(() => config?.onAnnotationStart?.());
    expect(
      screen.queryByText("Page feedback for Lead User"),
    ).not.toBeInTheDocument();

    act(() => config?.onAnnotationEnd?.());
    expect(screen.getByText("Page feedback for Lead User")).toBeInTheDocument();
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
