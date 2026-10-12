import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  DecisionEntry,
  RiskEntry,
  RiskPrefillRequest,
} from "../../../../report-sections";
import type { QuickAddItem } from "../../../../report-sections/client";

interface MockItemDialogProps {
  readonly open: boolean;
  readonly week: "current" | "next";
  readonly onCancel: () => void;
}

interface MockRiskDialogProps {
  readonly open: boolean;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly initialSeverity?: "at-risk" | "blocked" | undefined;
  readonly onSave: (next: RiskEntry) => void;
  readonly onCancel: () => void;
}

interface MockDecisionDialogProps {
  readonly open: boolean;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
}

vi.mock("../../../../period", () => ({
  DecisionEditDialog: ({ open, onSave, onCancel }: MockDecisionDialogProps) =>
    open ? (
      <div role="dialog" aria-label="Decision quick add">
        <button
          type="button"
          onClick={() =>
            onSave({
              id: "decision-new",
              productId: "product-a",
              productName: "Product A",
              text: "Decision",
              owner: "Lead",
              impact: "Impact",
              deadline: null,
              stageNames: ["Development"],
            })
          }
        >
          Save mocked decision
        </button>
        <button type="button" onClick={onCancel}>
          Cancel mocked decision
        </button>
      </div>
    ) : null,
  RequestReopenDialog: () => null,
}));

vi.mock("../../../../review", () => ({
  RiskEditDialog: ({
    open,
    defaultProductId,
    defaultActivityId,
    initialSeverity,
    onSave,
    onCancel,
  }: MockRiskDialogProps) =>
    open ? (
      <div
        role="dialog"
        aria-label="Risk quick add"
        data-product-id={defaultProductId}
        data-activity-id={defaultActivityId}
        data-severity={initialSeverity}
      >
        <button
          type="button"
          onClick={() =>
            onSave({
              id: "risk-new",
              productId: defaultProductId ?? "",
              productName: "Product A",
              stageNames: ["Development"],
              severity: initialSeverity ?? "at-risk",
              text: "Risk",
              impact: "Impact",
              mitigation: "Mitigation",
            })
          }
        >
          Save mocked risk
        </button>
        <button type="button" onClick={onCancel}>
          Cancel mocked risk
        </button>
      </div>
    ) : null,
}));

vi.mock("../../../../report-sections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../report-sections")>();
  return {
    ...actual,
    ItemEditDialog: ({ open, week, onCancel }: MockItemDialogProps) =>
      open ? (
        <div role="dialog" aria-label={`${week} Item quick add`}>
          <button type="button" onClick={onCancel}>
            Cancel mocked item
          </button>
        </div>
      ) : null,
  };
});
vi.mock("../../../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: () => null,
}));
vi.mock("../../../../../shared/ui/dialogs/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));
vi.mock("./submit-confirm-dialog", () => ({ SubmitConfirmDialog: () => null }));

import { buildLeadFormLoadedViewModel } from "../../../../report-sections";
import { makeDraftMergeSection } from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import {
  LeadFormDialogs,
  type LeadFormDialogsQuickAdd,
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

function buildViewModel(section: ReportSectionReadModel) {
  return buildLeadFormLoadedViewModel({
    active: section,
    draftSection: section,
    serverReadOnly: false,
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
  initialSlides = true,
  onRisksChange = vi.fn(),
  onDecisionsChange = vi.fn(),
}: {
  readonly initialSlides?: boolean;
  readonly onRisksChange?: (next: readonly RiskEntry[]) => void;
  readonly onDecisionsChange?: (next: readonly DecisionEntry[]) => void;
}) {
  const section = makeDraftMergeSection();
  const viewModel = buildViewModel(section);
  const [isSlidesMode, setIsSlidesMode] = useState(initialSlides);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);
  const [quickAddItem, setQuickAddItem] = useState<QuickAddItem | null>(null);
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );
  const [, setRenderCount] = useState(0);

  const quickAdd: LeadFormDialogsQuickAdd = {
    quickAddItem,
    onQuickAddSave: vi.fn(),
    onQuickAddCancel: () => setQuickAddItem(null),
    risksAddSignal,
    decisionsAddSignal,
    riskPrefill,
    onRisksChange,
    onDecisionsChange,
  };
  const productId = viewModel.products[0]?.id ?? "";

  return (
    <>
      <button type="button" onClick={() => setIsSlidesMode(false)}>
        Overview
      </button>
      <button type="button" onClick={() => setIsSlidesMode(true)}>
        Slides
      </button>
      <button
        type="button"
        onClick={() => setQuickAddItem({ week: "current", seq: 1 })}
      >
        Add current item
      </button>
      <button
        type="button"
        onClick={() => setQuickAddItem({ week: "next", seq: 1 })}
      >
        Add next item
      </button>
      <button
        type="button"
        onClick={() => setRisksAddSignal((signal) => signal + 1)}
      >
        Add risk signal
      </button>
      <button
        type="button"
        onClick={() => setDecisionsAddSignal((signal) => signal + 1)}
      >
        Add decision signal
      </button>
      <button
        type="button"
        onClick={() =>
          setRiskPrefill((current) => ({
            signal: (current?.signal ?? 0) + 1,
            productId,
            stageNames: ["Development"],
            severity: "blocked",
          }))
        }
      >
        Add blocker prefill
      </button>
      <button
        type="button"
        onClick={() => setRenderCount((count) => count + 1)}
      >
        Unrelated render
      </button>

      <LeadFormDialogs
        viewModel={viewModel}
        quickAdd={quickAdd}
        writeActions={writeActions}
        unsetOwnStageCount={0}
        draftSection={section}
        isSlidesMode={isSlidesMode}
      />
    </>
  );
}

describe("LeadFormDialogs Slides quick add", () => {
  it.each([
    ["Overview", false],
    ["Slides", true],
  ])(
    "routes Current and Next in %s through the shared Item host",
    async (_, mode) => {
      const user = userEvent.setup();
      render(<Harness initialSlides={mode} />);

      await user.click(
        screen.getByRole("button", { name: "Add current item" }),
      );
      expect(
        screen.getAllByRole("dialog", { name: "current Item quick add" }),
      ).toHaveLength(1);
      await user.click(
        screen.getByRole("button", { name: "Cancel mocked item" }),
      );

      await user.click(screen.getByRole("button", { name: "Add next item" }));
      expect(
        screen.getAllByRole("dialog", { name: "next Item quick add" }),
      ).toHaveLength(1);
    },
  );

  it("routes Risk and Decision commands to one canonical editor", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add risk signal" }));
    expect(
      screen.getAllByRole("dialog", { name: "Risk quick add" }),
    ).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Cancel mocked risk" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Add decision signal" }),
    );
    expect(
      screen.getAllByRole("dialog", { name: "Decision quick add" }),
    ).toHaveLength(1);
  });

  it("routes Blocker to Risk with the supplied product and blocked severity", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "Add blocker prefill" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Risk quick add" });
    expect(dialog).toHaveAttribute(
      "data-product-id",
      expect.stringMatching(/.+/),
    );
    expect(dialog).toHaveAttribute("data-severity", "blocked");
  });

  it("appends saved Risk and Decision records through draft actions", async () => {
    const user = userEvent.setup();
    const onRisksChange = vi.fn();
    const onDecisionsChange = vi.fn();
    render(
      <Harness
        onRisksChange={onRisksChange}
        onDecisionsChange={onDecisionsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add risk signal" }));
    await user.click(screen.getByRole("button", { name: "Save mocked risk" }));
    expect(onRisksChange).toHaveBeenCalledTimes(1);
    expect(onRisksChange.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "risk-new" })]),
    );

    await user.click(
      screen.getByRole("button", { name: "Add decision signal" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save mocked decision" }),
    );
    expect(onDecisionsChange).toHaveBeenCalledTimes(1);
    expect(onDecisionsChange.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "decision-new" })]),
    );
  });

  it.each([
    ["Risk", "Add risk signal", "Risk quick add"],
    ["Decision", "Add decision signal", "Decision quick add"],
    ["Blocker", "Add blocker prefill", "Risk quick add"],
  ])(
    "does not replay a stale %s command when Slides mounts",
    async (_kind, commandName, dialogName) => {
      const user = userEvent.setup();
      render(<Harness initialSlides={false} />);

      await user.click(screen.getByRole("button", { name: commandName }));
      await user.click(screen.getByRole("button", { name: "Slides" }));
      expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();

      await user.click(screen.getByRole("button", { name: commandName }));
      expect(
        screen.getByRole("dialog", { name: dialogName }),
      ).toBeInTheDocument();
      const cancelName =
        dialogName === "Risk quick add"
          ? "Cancel mocked risk"
          : "Cancel mocked decision";
      await user.click(screen.getByRole("button", { name: cancelName }));
      await user.click(
        screen.getByRole("button", { name: "Unrelated render" }),
      );
      expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    },
  );
});
