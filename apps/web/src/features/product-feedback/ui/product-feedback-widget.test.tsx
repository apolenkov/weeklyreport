// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { ProductFeedbackWidget } from "./product-feedback-widget";

const { agentation, navigation } = vi.hoisted(() => ({
  agentation: vi.fn(({ endpoint }: { endpoint: string }) => (
    <div>Agentation endpoint {endpoint}</div>
  )),
  navigation: {
    pathname: "/",
    searchParams: new URLSearchParams(),
  },
}));

vi.mock("agentation", () => ({ Agentation: agentation }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("./page-feedback-dialog", () => ({
  PageFeedbackDialog: () => <div>Page feedback</div>,
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
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
  navigation.pathname = "/";
  navigation.searchParams = new URLSearchParams();
  feedbackEnabled.mockReturnValue(true);
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
  it("mounts Agentation against the authenticated same-origin API", async () => {
    render(<ProductFeedbackWidget />);

    await screen.findByText("Agentation endpoint /api/v1/agentation");
    expect(agentation).toHaveBeenCalledWith(
      expect.objectContaining({
        copyToClipboard: true,
        endpoint: "/api/v1/agentation",
      }),
      undefined,
    );
    expect(screen.getByText("Page feedback")).toBeInTheDocument();
  });

  it.each(["lead", "viewer", "head", "admin"] as const)(
    "renders for authenticated %s users",
    async (role) => {
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

      expect(await screen.findByText("Page feedback")).toBeInTheDocument();
    },
  );

  it("joins the server session carried by an inbox deep link", async () => {
    navigation.pathname = "/lead/report";
    navigation.searchParams = new URLSearchParams(
      "agentationSession=session-7",
    );

    render(<ProductFeedbackWidget />);

    await screen.findByText("Agentation endpoint /api/v1/agentation");
    expect(agentation).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-7" }),
      undefined,
    );
  });

  it("switches sessions when only the inbox deep-link query changes", async () => {
    navigation.pathname = "/lead/report";
    navigation.searchParams = new URLSearchParams(
      "agentationSession=session-7",
    );
    const view = render(<ProductFeedbackWidget />);
    await screen.findByText("Agentation endpoint /api/v1/agentation");

    navigation.searchParams = new URLSearchParams(
      "agentationSession=session-8",
    );
    view.rerender(<ProductFeedbackWidget />);

    expect(agentation).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: "session-8" }),
      undefined,
    );
  });

  it("does not initialize while disabled or unauthenticated", async () => {
    feedbackEnabled.mockReturnValue(false);
    const first = render(<ProductFeedbackWidget />);
    expect(agentation).not.toHaveBeenCalled();
    first.unmount();

    feedbackEnabled.mockReturnValue(true);
    mockedSession.mockReturnValue({
      user: null,
      organization: null,
      isLoading: false,
      isAuthenticated: false,
    });
    render(<ProductFeedbackWidget />);
    await waitFor(() => expect(agentation).not.toHaveBeenCalled());
  });

  it("never mounts the development toolbar in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    render(<ProductFeedbackWidget />);

    expect(agentation).not.toHaveBeenCalled();
    expect(screen.queryByText("Page feedback")).not.toBeInTheDocument();
  });
});
