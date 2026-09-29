// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Annotation } from "agentation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { webEnv } from "../../../shared/lib/runtime/web-env";
import { ProductFeedbackWidget } from "./product-feedback-widget";
import { AGENTATION_CONFIRMATION_DELAYS_MS } from "./use-agentation-delivery-status";

interface AgentationMockProps {
  readonly copyToClipboard?: boolean;
  readonly endpoint: string;
  readonly onAnnotationAdd?: (annotation: Annotation) => void;
  readonly onAnnotationDelete?: (annotation: Annotation) => void;
  readonly onAnnotationsClear?: (annotations: Annotation[]) => void;
  readonly onSessionCreated?: (sessionId: string) => void;
  readonly sessionId?: string;
}

const { agentation, navigation } = vi.hoisted(() => ({
  agentation: vi.fn(({ endpoint }: AgentationMockProps) => (
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
  it("remounts the native client only when a cached page is restored", async () => {
    const view = render(<ProductFeedbackWidget />);
    const original = await screen.findByText(
      "Agentation endpoint /api/v1/agentation",
    );

    fireEvent(
      window,
      new PageTransitionEvent("pageshow", { persisted: false }),
    );
    expect(screen.getByText(original.textContent)).toBe(original);

    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(screen.getByText(original.textContent)).not.toBe(original);
    view.unmount();
    agentation.mockClear();
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(agentation).not.toHaveBeenCalled();
  });

  it("mounts Agentation against the authenticated same-origin API", async () => {
    render(<ProductFeedbackWidget />);

    await screen.findByText("Agentation endpoint /api/v1/agentation");
    const props = agentation.mock.calls.at(-1)?.[0];
    expect(props?.copyToClipboard).toBe(true);
    expect(props?.endpoint).toBe("/api/v1/agentation");
    expect(props?.onAnnotationAdd).toEqual(expect.any(Function));
    expect(props?.onAnnotationDelete).toEqual(expect.any(Function));
    expect(props?.onAnnotationsClear).toEqual(expect.any(Function));
    expect(props?.onSessionCreated).toEqual(expect.any(Function));
  });

  it("shows an honest persistent status and remounts native retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          id: "session-1",
          url: "/reports/report-1",
          status: "active",
          projectId: "weekly-report",
          createdAt: "2026-09-06T18:00:00.000Z",
          updatedAt: "2026-09-06T18:00:00.000Z",
          annotations: [],
        }),
      ),
    );

    try {
      render(<ProductFeedbackWidget />);
      const originalWidget = screen.getByText(
        "Agentation endpoint /api/v1/agentation",
      );
      const props = agentation.mock.calls.at(-1)?.[0];
      if (!props?.onAnnotationAdd || !props.onSessionCreated)
        throw new Error("Agentation delivery callbacks were not supplied");

      act(() => {
        props.onSessionCreated?.("session-1");
        props.onAnnotationAdd?.({
          id: "original-client-id",
          x: 10,
          y: 20,
          comment: "Keep this exact optimistic comment",
          element: "button",
          elementPath: "main > button",
          timestamp: 1_788_720_000_000,
          sessionId: "session-1",
        });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          AGENTATION_CONFIRMATION_DELAYS_MS.reduce(
            (total, delay) => total + delay,
            1,
          ),
        );
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not confirm that feedback was saved. Your annotation is still here.",
      );
      const retry = screen.getByRole("button", { name: "Retry" });
      fireEvent.click(retry);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not confirm that feedback was saved. Your annotation is still here.",
      );
      expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
      expect(
        screen.getByText("Agentation endpoint /api/v1/agentation"),
      ).not.toBe(originalWidget);
      expect(agentation.mock.calls.at(-1)?.[0].sessionId).toBe("session-1");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("remounts the native client when the authenticated actor changes", () => {
    const view = render(<ProductFeedbackWidget />);
    const original = screen.getByText("Agentation endpoint /api/v1/agentation");
    mockedSession.mockReturnValue({
      user: {
        id: "user-2",
        name: "Other Lead",
        email: "other@example.test",
        role: "lead",
      },
      organization: null,
      isLoading: false,
      isAuthenticated: true,
    });

    view.rerender(<ProductFeedbackWidget />);

    expect(screen.getByText(original.textContent)).not.toBe(original);
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

      expect(
        await screen.findByText("Agentation endpoint /api/v1/agentation"),
      ).toBeInTheDocument();
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

  it("does not join the first of repeated inbox sessions", async () => {
    navigation.pathname = "/lead/report";
    navigation.searchParams = new URLSearchParams(
      "agentationSession=session-7&agentationSession=session-8",
    );

    render(<ProductFeedbackWidget />);

    await screen.findByText("Agentation endpoint /api/v1/agentation");
    expect(agentation.mock.calls.at(-1)?.[0].sessionId).toBeUndefined();
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
  });
});
