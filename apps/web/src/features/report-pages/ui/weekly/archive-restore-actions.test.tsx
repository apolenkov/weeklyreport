// C4943 (TASK-503.66): both archive controls lock while any lifecycle write is in flight.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchiveRestoreActions } from "./archive-restore-actions";

// The page builds one lifecycle guard from the three mutation families, so the
// component receives the collapsed flag plus the two pending labels.
function mutationState(
  pending: {
    readonly archive?: boolean;
    readonly restore?: boolean;
    readonly publishOrReopen?: boolean;
  } = {},
) {
  const isArchivePending = pending.archive ?? false;
  const isRestorePending = pending.restore ?? false;
  return {
    isLifecyclePending:
      isArchivePending ||
      isRestorePending ||
      (pending.publishOrReopen ?? false),
    archiveLabel: isArchivePending ? "Archiving…" : "Archive",
    restoreLabel: isRestorePending ? "Restoring…" : "Restore",
  };
}

const noop = () => undefined;

describe("ArchiveRestoreActions lifecycle guard", () => {
  it.each([
    [
      "archive",
      "a publish/reopen write",
      { publishOrReopen: true },
      false,
      "Move this report to the archive",
    ],
    [
      "restore",
      "a publish/reopen write",
      { publishOrReopen: true },
      true,
      "Restore this report from the archive",
    ],
    [
      "restore",
      "an archive write",
      { archive: true },
      true,
      "Restore this report from the archive",
    ],
  ] as const)(
    "disables %s while %s is in flight",
    (_control, _pendingWrite, pending, archived, label) => {
      render(
        <ArchiveRestoreActions
          archived={archived}
          periodStatus="published"
          onArchive={noop}
          onRestore={noop}
          mutationState={mutationState(pending)}
        />,
      );
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    },
  );

  it.each([
    ["archive", false, "Move this report to the archive"],
    ["restore", true, "Restore this report from the archive"],
  ] as const)(
    "keeps %s enabled when no lifecycle write is in flight",
    (_control, archived, label) => {
      render(
        <ArchiveRestoreActions
          archived={archived}
          periodStatus="published"
          onArchive={noop}
          onRestore={noop}
          mutationState={mutationState()}
        />,
      );
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    },
  );
});
