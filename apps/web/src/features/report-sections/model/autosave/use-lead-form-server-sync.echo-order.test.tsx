import { act, render, screen } from "@testing-library/react";
import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@weeklyreport/shared";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import {
  CURRENT_ITEM_ID,
  makeDraftMergeSection,
} from "../lead-form/draft/lead-form-draft-merge-test-fixtures";
import type { DraftPatch } from "../lead-form/draft/lead-form-draft-patch";
import { leadFormGenerationOf } from "../lead-form/lead-form-generation";
import { useLeadFormDraftCore } from "../lead-form/use-lead-form-draft-core";
import type { AutosaveSaveReceipt } from "./autosave-types";
import { buildAutosaveHarness } from "./use-lead-form-autosave-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function EditAfterReceipt({
  receipt,
  apply,
}: {
  readonly receipt: AutosaveSaveReceipt | null;
  readonly apply: (patch: DraftPatch) => void;
}) {
  const applied = useRef(false);
  useEffect(() => {
    if (receipt?.attemptToken !== "original" || applied.current) return;
    applied.current = true;
    apply({
      kind: "item-patch",
      itemId: CURRENT_ITEM_ID,
      patch: { text: "Edit after acknowledgement" },
    });
  }, [receipt, apply]);
  return null;
}

it.each([true, false])(
  "reconciles current state when a saved read and receipt arrive together (child edit: %s)",
  async (childEdit) => {
    const initial = makeDraftMergeSection();
    const response = Promise.withResolvers<ReportSectionReadModel>();
    const harness = buildAutosaveHarness({
      mutationFn: () => response.promise,
    });
    const refetch = vi.fn().mockResolvedValue(undefined);
    function Parent({ server }: { readonly server: ReportSectionReadModel }) {
      const draft = useLeadFormDraftCore({
        writePort: harness.writePort,
        generation: leadFormGenerationOf(initial),
        serverSection: server,
        sectionIdForActions: initial.reportSectionId,
        serverReadOnly: false,
        refetchSection: refetch,
      });
      return (
        <>
          <button
            onClick={() =>
              draft.apply({
                kind: "item-patch",
                itemId: CURRENT_ITEM_ID,
                patch: { text: "Submitted edit" },
              })
            }
          >
            Prepare
          </button>
          <button
            onClick={() => {
              void draft.savePersisted("original");
            }}
          >
            Save
          </button>
          <output data-version={draft.draft?.version}>
            {draft.draft?.items.find((row) => row.id === CURRENT_ITEM_ID)?.text}
          </output>
          {childEdit && (
            <EditAfterReceipt
              receipt={draft.lastSaveReceipt}
              apply={draft.apply}
            />
          )}
        </>
      );
    }
    const { rerender } = render(<Parent server={initial} />, {
      wrapper: harness.wrapper,
    });
    act(() => screen.getByRole("button", { name: "Prepare" }).click());
    act(() => screen.getByRole("button", { name: "Save" }).click());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const request = expectDefined(harness.calls[0]);
    const saved = reportSectionReadModelSchema.parse({
      ...initial,
      version: request.version + 1,
      items: request.items,
    });
    await act(async () => {
      rerender(<Parent server={saved} />);
      response.resolve(saved);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      childEdit ? "Edit after acknowledgement" : "Submitted edit",
    );
    if (!childEdit)
      expect(screen.getByRole("status")).toHaveAttribute(
        "data-version",
        String(saved.version),
      );
  },
);
