// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "../../../shared/lib/auth/session-provider";
import { useSession } from "../../../shared/lib/auth/session-provider";
import { ProductFeedbackPage } from "./product-feedback-page";

const { changeStatus, deleteFeedback, useSitepingInbox } = vi.hoisted(() => ({
  changeStatus: vi.fn(() => Promise.resolve()),
  deleteFeedback: vi.fn(() => Promise.resolve()),
  useSitepingInbox: vi.fn(),
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
} as const;

const inboxState = {
  project: "weekly-report",
  projects: ["weekly-report"],
  setProject: vi.fn(),
  status: "all",
  setStatus: vi.fn(),
  type: "all",
  setType: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  items: [pageFeedback],
  total: 1,
  counts: {},
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  view: "ready",
  loadMore: vi.fn(() => Promise.resolve()),
  refresh: vi.fn(() => Promise.resolve()),
  focusedId: null,
  focus: vi.fn(),
  focusNext: vi.fn(),
  focusPrev: vi.fn(),
  openedId: null,
  opened: null,
  openFeedback: vi.fn(),
  closeFeedback: vi.fn(),
  changeStatus,
  deleteFeedback,
  pendingUndo: null,
  undo: vi.fn(() => Promise.resolve()),
};

useSitepingInbox.mockReturnValue(inboxState);

vi.mock("@siteping/dashboard", () => ({ useSitepingInbox }));
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
}

beforeEach(() => {
  vi.clearAllMocks();
  useSitepingInbox.mockReturnValue(inboxState);
});

describe("ProductFeedbackPage role controls", () => {
  it.each(["lead", "viewer"] as const)(
    "shows own feedback read-only for %s",
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
        screen.queryByRole("button", { name: "Delete feedback" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: "Open page feedback on /lead/report/report-1",
        }),
      ).toHaveAttribute("href", "/lead/report/report-1");
      expect(screen.getByText("Page feedback")).toBeInTheDocument();
    },
  );

  it("lets head triage group feedback without delete", () => {
    setRole("head");
    render(<ProductFeedbackPage />);
    expect(screen.getByText(/Your reporting group/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status for feedback/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete feedback" }),
    ).not.toBeInTheDocument();
  });

  it("lets admin triage and delete global feedback", () => {
    setRole("admin");
    render(<ProductFeedbackPage />);
    expect(screen.getByText(/All Weekly Report feedback/)).toBeInTheDocument();
    expect(screen.getByText(/right-click any element/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status for feedback/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open page feedback on /lead/report/report-1",
      }),
    ).toHaveAttribute("href", "/lead/report/report-1");
  });

  it("opens captured annotation evidence and keeps a secondary live link", () => {
    setRole("admin");
    useSitepingInbox.mockReturnValue({
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

    expect(screen.getByText("Annotation")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review captured annotation on /lead/report/report-1",
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
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "LI" &&
          element.textContent.includes("Example console failure")
        );
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open live page" }),
    ).toHaveAttribute(
      "href",
      "/head/report/report-1?authorId=lead-user&siteping=feedback-1&sitepingUrl=%2Flead%2Freport%2Freport-1",
    );
  });

  it("keeps a live deep link when an old annotation has no capture", () => {
    setRole("admin");
    useSitepingInbox.mockReturnValue({
      ...inboxState,
      items: [
        {
          ...pageFeedback,
          annotations: [{ id: "annotation-1" }],
        },
      ],
    });

    render(<ProductFeedbackPage />);

    expect(
      screen.getByRole("link", {
        name: "Open annotation on /lead/report/report-1",
      }),
    ).toHaveAttribute(
      "href",
      "/head/report/report-1?authorId=lead-user&siteping=feedback-1&sitepingUrl=%2Flead%2Freport%2Freport-1",
    );
  });
});
