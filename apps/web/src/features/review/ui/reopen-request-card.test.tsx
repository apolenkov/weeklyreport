import { REOPEN_AUTO_CLOSE_NOTES } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type ReopenRequest, ReopenRequestCard } from "./reopen-request-card";

const REQUEST: ReopenRequest = {
  id: "request-1",
  status: "pending",
  reason: "The submitted numbers need correction.",
  reviewNote: null,
  createdAt: "2026-07-28T10:00:00.000Z",
  reviewedAt: null,
  reviewedBy: null,
  requestedBy: { name: "Vasily Ivanov", email: "vasily@example.com" },
  report: {
    periodStart: "2026-07-20T00:00:00.000Z",
    periodEnd: "2026-07-26T00:00:00.000Z",
    weekLabel: "Week 30",
  },
};

function renderCard(
  request: ReopenRequest,
  overrides: Partial<Parameters<typeof ReopenRequestCard>[0]> = {},
) {
  const props = {
    request,
    isResponding: false,
    note: "",
    isSaving: false,
    pendingDecision: undefined,
    onStartRespond: vi.fn(),
    onCancelRespond: vi.fn(),
    onNoteChange: vi.fn(),
    onReject: vi.fn(),
    onApprove: vi.fn(),
    ...overrides,
  };
  render(<ReopenRequestCard {...props} />);
  return props;
}

describe("ReopenRequestCard", () => {
  it("presents a pending request and opens its response flow", () => {
    const props = renderCard(REQUEST);

    expect(screen.getByText("Vasily Ivanov")).toBeInTheDocument();
    expect(screen.getByText("vasily@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(
      screen.getByText("The submitted numbers need correction."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    expect(props.onStartRespond).toHaveBeenCalledOnce();
  });

  it("owns the response interface while a request is being decided", () => {
    const onNoteChange = vi.fn();
    const onApprove = vi.fn();
    renderCard(REQUEST, { isResponding: true, onNoteChange, onApprove });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Approved after review." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onNoteChange).toHaveBeenCalledWith("Approved after review.");
    expect(onApprove).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Respond" }),
    ).not.toBeInTheDocument();
  });

  it("presents the reviewer and review note for a decided request", () => {
    renderCard({
      ...REQUEST,
      status: "approved",
      reviewNote: "Correction window reopened.",
      reviewedAt: "2026-07-28T12:00:00.000Z",
      reviewedBy: { name: "Head User" },
    });

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Correction window reopened.")).toBeInTheDocument();
    expect(screen.getByText(/Head User/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Respond" }),
    ).not.toBeInTheDocument();
  });

  it("labels a request closed by the period reopen as a system action", () => {
    renderCard({
      ...REQUEST,
      status: "rejected",
      reviewNote: REOPEN_AUTO_CLOSE_NOTES.periodReopened,
      reviewedAt: "2026-07-28T12:00:00.000Z",
      reviewedBy: null,
    });

    expect(screen.getByText("Auto-closed")).toBeInTheDocument();
    expect(screen.queryByText("Rejected")).not.toBeInTheDocument();
    expect(screen.getByText("System Note")).toBeInTheDocument();
    expect(screen.queryByText("Head Comment")).not.toBeInTheDocument();
    expect(
      screen.getByText(REOPEN_AUTO_CLOSE_NOTES.periodReopened),
    ).toBeInTheDocument();
  });

  it("keeps a head rejection labelled Rejected with the head comment", () => {
    renderCard({
      ...REQUEST,
      status: "rejected",
      reviewNote: "Not now.",
      reviewedAt: "2026-07-28T12:00:00.000Z",
      reviewedBy: { name: "Head User" },
    });

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Head Comment")).toBeInTheDocument();
  });

  it("labels a stale-approval closure as a system action even though a reviewer is set", () => {
    renderCard({
      ...REQUEST,
      status: "rejected",
      reviewNote: REOPEN_AUTO_CLOSE_NOTES.sectionAlreadyReopened,
      reviewedAt: "2026-07-28T12:00:00.000Z",
      reviewedBy: { name: "Head User" },
    });

    expect(screen.getByText("Auto-closed")).toBeInTheDocument();
    expect(screen.getByText("System Note")).toBeInTheDocument();
  });

  it("keeps a human rejection labelled Rejected after its reviewer was deleted", () => {
    renderCard({
      ...REQUEST,
      status: "rejected",
      reviewNote: "Not now.",
      reviewedAt: "2026-07-28T12:00:00.000Z",
      reviewedBy: null,
    });

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Head Comment")).toBeInTheDocument();
  });

  it("labels the creation time as requested, matching the dashboard term (R40)", () => {
    renderCard(REQUEST);

    expect(screen.getByText(/· requested /)).toBeInTheDocument();
    expect(screen.queryByText(/submitted \d/i)).toBeNull();
  });
});
