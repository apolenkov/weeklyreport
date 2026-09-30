import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadInfo } from "../model/dashboard";
import { LeadPrimaryAction, LeadSecondaryActions } from "./lead-queue-actions";

vi.mock("./remind-lead-button", () => ({
  RemindLeadButton: () => <button type="button">Remind</button>,
}));
vi.mock("./request-changes-button", () => ({
  RequestChangesButton: () => <button type="button">Request Changes</button>,
}));
vi.mock("./revoke-lead-button", () => ({
  RevokeLeadButton: () => <button type="button">Revoke</button>,
}));

const REPORT_ID = "10000000-0000-4000-8000-000000000001";

function lead(actions: LeadInfo["actions"]): LeadInfo {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    initials: "AL",
    name: "Alice Lead",
    role: "lead",
    status: "draft",
    trafficLights: [],
    lastEditAt: new Date(),
    submittedAt: null,
    isStale: false,
    isCurrentUser: false,
    reportContentCount: 1,
    reportSectionId: "30000000-0000-4000-8000-000000000001",
    version: 2,
    reviews: [],
    reminderRuleId: "40000000-0000-4000-8000-000000000001",
    reviewState: "none",
    reviewLabel: "Not reviewed",
    attentionLabel: "No signal",
    actions,
    priority: "active",
  };
}

function renderActions(value: LeadInfo) {
  const onMutated = vi.fn();
  return render(
    <>
      <LeadPrimaryAction
        lead={value}
        reportId={REPORT_ID}
        onMutated={onMutated}
      />
      <LeadSecondaryActions
        lead={value}
        reportId={REPORT_ID}
        onMutated={onMutated}
      />
    </>,
  );
}

describe("lead queue contextual actions", () => {
  it("makes Open primary and Remind secondary for a content-bearing draft", () => {
    renderActions(
      lead({
        canOpen: true,
        canRemind: true,
        canReview: false,
        canRequestChanges: false,
        canRevoke: false,
      }),
    );

    expect(
      screen.getByRole("link", { name: "Open Alice Lead report section" }),
    ).toHaveAttribute(
      "href",
      `/head/report/${REPORT_ID}?authorId=20000000-0000-4000-8000-000000000001`,
    );
    expect(screen.getByRole("button", { name: "Remind" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Review Alice Lead report section" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request Changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoke" }),
    ).not.toBeInTheDocument();
  });

  it("makes Review primary and keeps Open, Request Changes, and Revoke distinct", () => {
    renderActions({
      ...lead({
        canOpen: true,
        canRemind: false,
        canReview: true,
        canRequestChanges: true,
        canRevoke: true,
      }),
      status: "submitted",
      submittedAt: new Date("2026-09-15T08:00:00Z"),
    });

    const reviewLink = screen.getByRole("link", {
      name: "Review Alice Lead report section",
    });
    expect(reviewLink).toHaveAttribute(
      "href",
      `/head/report/${REPORT_ID}?authorId=20000000-0000-4000-8000-000000000001`,
    );
    expect(reviewLink).toHaveClass(
      "min-h-[var(--touch-target-min)]",
      "focus-visible:ring-2",
      "bg-[var(--color-starbucks-accent)]",
    );
    expect(
      screen.getByRole("link", { name: "Review Alice Lead report section" }),
    ).toBeVisible();
    const openLink = screen.getByRole("link", {
      name: "Open Alice Lead report section",
    });
    expect(openLink).toBeVisible();
    expect(openLink).toHaveClass("bg-[var(--color-card)]");
    expect(
      screen.getByRole("button", { name: "Request Changes" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeVisible();

    const actionGroup = screen.getByLabelText("Lead actions");
    expect(actionGroup).toHaveClass(
      "[&>a]:h-[var(--dashboard-action-h)]",
      "[&>a]:w-[var(--dashboard-detail-action-w)]",
      "[&>button]:h-[var(--dashboard-action-h)]",
      "[&>button]:w-[var(--dashboard-detail-action-w)]",
    );
  });

  it("keeps a published content row navigation-only", () => {
    renderActions(
      lead({
        canOpen: true,
        canRemind: false,
        canReview: false,
        canRequestChanges: false,
        canRevoke: false,
      }),
    );

    expect(
      screen.getByRole("link", { name: "Open Alice Lead report section" }),
    ).toBeVisible();
    expect(
      screen.getByText("No additional actions for this state."),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders read-only text for a row with no available primary action", () => {
    renderActions(
      lead({
        canOpen: false,
        canRemind: false,
        canReview: false,
        canRequestChanges: false,
        canRevoke: false,
      }),
    );

    expect(screen.getByText("Read only")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
