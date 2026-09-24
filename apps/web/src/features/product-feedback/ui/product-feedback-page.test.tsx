// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "../../../shared/lib/auth/session-provider";
import { useSession } from "../../../shared/lib/auth/session-provider";
import { ProductFeedbackPage } from "./product-feedback-page";

const { changeStatus, useProductFeedbackInbox } = vi.hoisted(() => ({
  changeStatus: vi.fn(() => Promise.resolve()),
  useProductFeedbackInbox: vi.fn(),
}));

const pageFeedback = {
  id: "feedback-1",
  projectName: "weekly-report",
  type: "bug",
  message: "The row is difficult to read",
  status: "open",
  url: "/lead/report/report-1",
  urlPattern: null,
  authorName: "Lead User",
  authorEmail: "lead@example.test",
  authorUserId: "lead-user",
  authorReportingGroupId: "group-1",
  viewport: "1440x900",
  userAgent: "test",
  clientId: "client-one",
  resolvedAt: null,
  createdAt: new Date("2026-09-03T08:00:00Z"),
  updatedAt: new Date("2026-09-03T08:00:00Z"),
  annotations: [],
  screenshotUrl: null,
  screenshotRegion: null,
  diagnostics: null,
  source: "legacy",
  capabilities: {
    editOriginal: true,
    triage: false,
    reply: false,
    dismiss: false,
    delete: false,
  },
  thread: [],
  agentationContext: null,
} as const;

const inboxState = {
  status: "all",
  setStatus: vi.fn(),
  type: "all",
  setType: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  items: [pageFeedback],
  view: "ready",
  refresh: vi.fn(() => Promise.resolve()),
  changeStatus,
  editOriginal: vi.fn(() => Promise.resolve()),
  reply: vi.fn(() => Promise.resolve()),
  dismiss: vi.fn(() => Promise.resolve()),
  deleteFeedback: vi.fn(() => Promise.resolve()),
};

useProductFeedbackInbox.mockReturnValue(inboxState);

vi.mock("../model/use-product-feedback-inbox", () => ({
  useProductFeedbackInbox,
}));
vi.mock("../../../shared/lib/auth/session-provider", () => ({
  useSession: vi.fn(),
}));

const mockedSession = vi.mocked(useSession);

function setRole(role: SessionUser["role"]): void {
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
  useProductFeedbackInbox.mockReturnValue({
    ...inboxState,
    items: [
      {
        ...pageFeedback,
        capabilities: {
          editOriginal: role === "lead",
          triage: role === "head" || role === "admin",
          reply: role !== "viewer",
          dismiss: role === "head" || role === "admin",
          delete: role === "admin",
        },
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useProductFeedbackInbox.mockReturnValue(inboxState);
});

describe("ProductFeedbackPage role controls", () => {
  it.each(["lead", "viewer"] as const)(
    "keeps status triage server-scoped for %s",
    (role) => {
      setRole(role);
      render(<ProductFeedbackPage />);
      expect(
        screen.getByText("Your feedback", { exact: false }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/Status for feedback/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Delete" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("Legacy feedback")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search" })).toHaveAttribute(
        "name",
        "feedbackSearch",
      );
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveAttribute(
        "name",
        "feedbackStatus",
      );
      expect(screen.getByRole("combobox", { name: "Type" })).toHaveAttribute(
        "name",
        "feedbackType",
      );
    },
  );

  it("lets head triage group feedback without delete", () => {
    setRole("head");
    render(<ProductFeedbackPage />);
    expect(screen.getByText(/Your reporting group/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status for feedback/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("lets admin triage global feedback with capability-scoped delete", () => {
    setRole("admin");
    render(<ProductFeedbackPage />);
    expect(screen.getByText(/All Weekly Report feedback/)).toBeInTheDocument();
    expect(screen.getByText(/proposed layout changes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status for feedback/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens captured annotation evidence without navigation", () => {
    setRole("admin");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      items: [
        {
          ...pageFeedback,
          annotations: [{ id: "annotation-1" }],
          screenshotUrl: "data:image/png;base64,AAAA",
          screenshotRegion: {
            xPct: 0.1,
            yPct: 0.2,
            wPct: 0.3,
            hPct: 0.4,
          },
          diagnostics: {
            console: [
              {
                level: "error",
                message: "Example console failure",
                timestamp: "2026-09-03T08:00:00Z",
              },
            ],
            network: [],
          },
        },
      ],
    });

    render(<ProductFeedbackPage />);

    expect(screen.getByText("Legacy feedback")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Details",
      }),
    );

    expect(
      screen.getByRole("img", {
        name: "Page screenshot captured with this annotation",
      }),
    ).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByLabelText("Annotated region")).toHaveStyle({
      height: "40%",
      left: "10%",
      top: "20%",
      width: "30%",
    });
    expect(
      screen.getByRole("img", { name: "Annotated region" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "LI" &&
          element.textContent.includes("Example console failure")
        );
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not expose navigation for an old annotation without capture", () => {
    setRole("admin");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      items: [
        {
          ...pageFeedback,
          annotations: [{ id: "annotation-1" }],
        },
      ],
    });

    render(<ProductFeedbackPage />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps Agentation feedback entirely in the inbox", () => {
    setRole("admin");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      items: [
        {
          ...pageFeedback,
          id: "agentation-1",
          source: "agentation" as const,
          annotations: [{ id: "annotation-1" }],
          agentationSessionId: "session-1",
          agentationAnnotationId: "annotation-1",
        },
      ],
    });

    render(<ProductFeedbackPage />);

    expect(screen.getByText("Agentation")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("session-1")).toBeInTheDocument();
    expect(screen.getByText("annotation-1")).toBeInTheDocument();
  });
});

describe("ProductFeedbackPage inbox states", () => {
  it("shows the loading placeholder while the inbox loads", () => {
    setRole("lead");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      view: "loading",
      items: [],
    });

    render(<ProductFeedbackPage />);

    expect(screen.getByText(/Loading feedback/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("No feedback matches these filters.")).toBeNull();
    expect(screen.queryByText("The row is difficult to read")).toBeNull();
  });

  it("surfaces an alert and retries via inbox.refresh on error", () => {
    setRole("lead");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      view: "error",
      items: [],
    });

    render(<ProductFeedbackPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Feedback is unavailable. Please try again.",
    );
    expect(screen.queryByText("The row is difficult to read")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(inboxState.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when no feedback matches", () => {
    setRole("lead");
    useProductFeedbackInbox.mockReturnValue({
      ...inboxState,
      view: "empty",
      items: [],
    });

    render(<ProductFeedbackPage />);

    expect(
      screen.getByText("No feedback matches these filters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("The row is difficult to read")).toBeNull();
  });
});
