// C4943 (TASK-503.66): the archive/restore control must not be clickable while a publish/reopen write is in flight.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchiveRestoreActions } from "./archive-restore-actions";

// The page passes its whole mutationState, which also carries isPublishOrReopenPending.
function mutationState(isPublishOrReopenPending: boolean) {
  return {
    isPublishOrReopenPending,
    isArchivePending: false,
    isRestorePending: false,
    archiveLabel: "Archive",
    restoreLabel: "Restore",
  };
}

const noop = () => undefined;

describe("ArchiveRestoreActions lifecycle pending", () => {
  it.each([
    ["archive", false, "published", "Move this report to the archive"],
    ["restore", true, "published", "Restore this report from the archive"],
  ] as const)(
    "disables %s while publish/reopen is pending",
    (_name, archived, periodStatus, label) => {
      render(
        <ArchiveRestoreActions
          archived={archived}
          periodStatus={periodStatus}
          onArchive={noop}
          onRestore={noop}
          mutationState={mutationState(true)}
        />,
      );
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    },
  );

  it("stays enabled when no lifecycle write is pending", () => {
    render(
      <ArchiveRestoreActions
        archived={false}
        periodStatus="published"
        onArchive={noop}
        onRestore={noop}
        mutationState={mutationState(false)}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Move this report to the archive" }),
    ).toBeEnabled();
  });
});
