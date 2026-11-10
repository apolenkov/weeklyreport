// @vitest-environment jsdom
// The publish confirmation tells the Head which unfinished risks and decisions
// the published report leaves out (openspec: viewer-report-navigation).
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PublishLockButton } from "./publish-lock-button";

const NOTE = "2 unfinished risks will be left out of the published report.";

async function openConfirmation(pendingCount: number, note?: string) {
  render(
    <PublishLockButton
      pendingCount={pendingCount}
      totalLeads={6}
      periodStatus="open"
      onPublish={vi.fn()}
      onReopen={vi.fn()}
      omittedRecordsNote={note}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: /publish & lock/iu }),
  );
}

describe("PublishLockButton — records left out", () => {
  it("names the left-out records when every lead has submitted", async () => {
    await openConfirmation(0, NOTE);

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText(/All 6 leads have submitted/u)).toBeInTheDocument();
  });

  it("keeps the pending-leads warning beside the left-out records", async () => {
    await openConfirmation(2, NOTE);

    expect(screen.getByText(/2 of 6 leads/u)).toBeInTheDocument();
    expect(
      screen.getByText(
        `Their sections will appear empty in the published report. ${NOTE}`,
      ),
    ).toBeInTheDocument();
  });

  it("adds nothing when no record is left out", async () => {
    await openConfirmation(0);

    expect(screen.queryByText(/left out/u)).not.toBeInTheDocument();
  });
});
