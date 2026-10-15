import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { RiskPrefillRequest } from "../../../../report-sections";

interface MockRiskDialogProps {
  readonly open: boolean;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly initialSeverity?: "at-risk" | "blocked" | undefined;
  readonly initialStageNames?: readonly string[] | undefined;
  readonly onCancel: () => void;
}

vi.mock("../../../../period", () => ({
  DecisionEditDialog: () => null,
  RequestReopenDialog: () => null,
}));
vi.mock("../../../../review", () => ({
  RiskEditDialog: ({
    open,
    defaultProductId,
    defaultActivityId,
    initialSeverity,
    initialStageNames,
    onCancel,
  }: MockRiskDialogProps) =>
    open ? (
      <div
        role="dialog"
        aria-label="Risk quick add"
        data-product={defaultProductId}
        data-activity={defaultActivityId}
        data-severity={initialSeverity}
        data-stages={initialStageNames?.join(",")}
      >
        <button type="button" onClick={onCancel}>
          Cancel mocked risk
        </button>
      </div>
    ) : null,
}));
vi.mock("../../../../report-sections", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../report-sections")>()),
  ItemEditDialog: () => null,
}));
vi.mock("../../../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: () => null,
}));
vi.mock("../../../../../shared/ui/dialogs/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));
vi.mock("./submit-confirm-dialog", () => ({ SubmitConfirmDialog: () => null }));

import { buildLeadFormLoadedViewModel } from "../../../../report-sections";
import {
  ACTIVITY_ID,
  makeDraftMergeSection,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import {
  LeadFormDialogs,
  type LeadFormDialogsWriteActions,
} from "./lead-form-dialogs";

const writeActions: LeadFormDialogsWriteActions = {
  showSubmitConfirm: false,
  cancelSubmit: vi.fn(),
  handleConfirmSubmit: vi.fn(),
  submitPending: false,
  showReopenDialog: false,
  reopenPending: false,
  reopenError: null,
  handleRequestReopen: vi.fn(),
  closeReopenDialog: vi.fn(),
  showRevokeDialog: false,
  confirmRevoke: vi.fn(),
  cancelRevoke: vi.fn(),
  pendingFillFrom: false,
  fillFromPending: false,
  confirmPendingFillFrom: vi.fn(),
  cancelPendingFillFrom: vi.fn(),
};

function viewModelFor(section: ReportSectionReadModel, readOnly: boolean) {
  return buildLeadFormLoadedViewModel({
    active: section,
    draftSection: section,
    serverReadOnly: readOnly,
    canRequestReopen: false,
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    history: [],
    crossAuthors: [],
    foreignContent: undefined,
    isEveryone: false,
    visibilityHydrated: true,
    isForeignSlidesDeck: false,
    isSubmitted: false,
    selectedPeriodId: null,
    showArchivePeriods: false,
  });
}

function Harness({
  startReadOnly,
  prefillParent = "product",
}: {
  readonly startReadOnly: boolean;
  readonly prefillParent?: "product" | "activity";
}) {
  const section = makeDraftMergeSection();
  const [readOnly, setReadOnly] = useState(startReadOnly);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );
  const viewModel = viewModelFor(section, readOnly);
  return (
    <>
      <button type="button" onClick={() => setReadOnly(false)}>
        Become editable
      </button>
      <button
        type="button"
        onClick={() => setRisksAddSignal((signal) => signal + 1)}
      >
        Add risk manually
      </button>
      <button
        type="button"
        onClick={() =>
          setRiskPrefill((current) => ({
            signal: (current?.signal ?? 0) + 1,
            ...(prefillParent === "product"
              ? { productId: PROJECT_ID, stageNames: ["Development"] }
              : { activityId: ACTIVITY_ID, stageNames: [] }),
            severity: "blocked",
          }))
        }
      >
        Add blocker prefill
      </button>
      <LeadFormDialogs
        viewModel={viewModel}
        quickAdd={{
          quickAddItem: null,
          onQuickAddSave: vi.fn(),
          onQuickAddCancel: vi.fn(),
          risksAddSignal,
          decisionsAddSignal: 0,
          riskPrefill,
          onRisksChange: vi.fn(),
          onDecisionsChange: vi.fn(),
        }}
        writeActions={writeActions}
        unsetOwnStageCount={0}
        draftSection={section}
        isSlidesMode
      />
    </>
  );
}

// TASK-503.62 / C4817. A Blocker prefill raised while the report is read-only
// opens nothing (openCreate is a no-op), but the host keeps the prefill. The
// next permitted manual Add must start from an empty form.
describe("Slides risk quick add — a prefill refused while read-only", () => {
  it.each(["product", "activity"] as const)(
    "preserves an accepted %s prefill at the host boundary",
    async (prefillParent) => {
      const user = userEvent.setup();
      render(<Harness startReadOnly={false} prefillParent={prefillParent} />);

      await user.click(
        screen.getByRole("button", { name: "Add blocker prefill" }),
      );

      const dialog = screen.getByRole("dialog", { name: "Risk quick add" });
      expect(dialog).toHaveAttribute("data-severity", "blocked");
      if (prefillParent === "product") {
        expect(dialog).toHaveAttribute("data-product", PROJECT_ID);
        expect(dialog).not.toHaveAttribute("data-activity");
        expect(dialog).toHaveAttribute("data-stages", "Development");
      } else {
        expect(dialog).toHaveAttribute("data-activity", ACTIVITY_ID);
        expect(dialog).not.toHaveAttribute("data-product");
        expect(dialog).toHaveAttribute("data-stages", "");
      }
    },
  );

  it("control: a manual Add on an editable report starts without a prefill", async () => {
    const user = userEvent.setup();
    render(<Harness startReadOnly={false} />);

    await user.click(screen.getByRole("button", { name: "Add risk manually" }));

    const dialog = screen.getByRole("dialog", { name: "Risk quick add" });
    expect(dialog).not.toHaveAttribute("data-severity");
    expect(dialog).not.toHaveAttribute("data-stages");
  });

  it("does not carry a refused read-only prefill into the next manual Add", async () => {
    const user = userEvent.setup();
    render(<Harness startReadOnly />);

    await user.click(
      screen.getByRole("button", { name: "Add blocker prefill" }),
    );
    expect(screen.queryByRole("dialog", { name: "Risk quick add" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Become editable" }));
    expect(screen.queryByRole("dialog", { name: "Risk quick add" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add risk manually" }));

    const dialog = screen.getByRole("dialog", { name: "Risk quick add" });
    expect(dialog).not.toHaveAttribute("data-severity");
    expect(dialog).not.toHaveAttribute("data-stages");
  });
});
