import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { LeadFormWriteError } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import {
  AUTOSAVE_SECTION_ID,
  buildAutosaveHarness,
} from "./use-lead-form-autosave-harness";
import { useDraftServerSync } from "./use-lead-form-server-sync";

const projectId = "22222222-2222-2222-2222-222222222222";
const itemId = "44444444-4444-4444-4444-444444444444";
const localText = "My edited work";

function section(version: number, otherText: string): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: AUTOSAVE_SECTION_ID,
    version,
    items: [
      {
        id: version > 1 ? "88888888-8888-8888-8888-888888888888" : itemId,
        stableId: "55555555-5555-5555-5555-555555555555",
        projectId,
        activityId: null,
        type: "current",
        text: "Original work",
        tag: "delivery",
        workflowStatus: "in_progress",
        pausedReason: null,
        carriedOver: false,
        nextStepText: null,
        comments: [],
        stageNames: ["Development"],
      },
      {
        id: "66666666-6666-6666-6666-666666666666",
        stableId: "77777777-7777-7777-7777-777777777777",
        projectId,
        activityId: null,
        type: "current",
        text: otherText,
        tag: "delivery",
        workflowStatus: "in_progress",
        pausedReason: null,
        carriedOver: false,
        nextStepText: null,
        comments: [],
        stageNames: ["Development"],
      },
    ],
  });
}

it("keeps inline text recoverable after a conflicting save and later refetch", async () => {
  let rejectSave!: (reason: Error) => void;
  const deferred = new Promise<ReportSectionReadModel>((_resolve, reject) => {
    rejectSave = reject;
  });
  const { wrapper, calls, writePort } = buildAutosaveHarness({
    mutationFn: () => deferred,
  });
  const handleConflict = vi.fn();
  const useTab = () => {
    const [serverSection, setServerSection] = useState(
      section(1, "Other original"),
    );
    const [draftSection, setDraftSection] =
      useState<ReportSectionReadModel | null>(null);
    const sync = useDraftServerSync({
      generation: null,
      receiptScope: "inline-conflict-test",
      writePort,
      serverSection,
      reportSectionId: AUTOSAVE_SECTION_ID,
      payload: draftSection && sectionToDraftPayload(draftSection),
      enabled: draftSection !== null,
      localOnlyRows: 0,
      version: serverSection.version,
      setVersionSafe: vi.fn(),
      acceptVersion: () => true,
      setIsSubmitted: () => undefined,
      setDraftSection,
      handleConflict,
    });
    return { draftSection, setDraftSection, setServerSection, sync };
  };
  const { result } = renderHook(() => useTab(), { wrapper });
  act(() => {
    result.current.setDraftSection(
      (draft) =>
        draft && {
          ...draft,
          items: draft.items.map((item) =>
            item.id === itemId ? { ...item, text: localText } : item,
          ),
        },
    );
  });
  expect(result.current.draftSection?.items[0]?.text).toBe(localText);
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.sync.autosave.forceSave();
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.items[0]?.text).toBe(localText);
  act(() =>
    result.current.setDraftSection(
      (draft) =>
        draft && {
          ...draft,
          items: draft.items.map((item) =>
            item.id === itemId ? { ...item, text: "Latest typing" } : item,
          ),
        },
    ),
  );
  await act(async () => {
    rejectSave(new LeadFormWriteError("conflict", "stale version"));
    await saving;
  });
  expect(handleConflict).toHaveBeenCalledTimes(1);
  expect(result.current.draftSection?.items[0]?.text).toBe("Original work");
  act(() => {
    result.current.setServerSection(section(2, "Other updated on server"));
  });

  expect
    .soft(result.current.draftSection?.items[1]?.text)
    .toBe("Other updated on server");
  expect.soft(result.current.sync.lastSaveReceipt).toBeNull();
  expect.soft(result.current.sync.autosave.state).not.toBe("saved");
  expect.soft(result.current.sync.autosave.state).toBe("error");
  expect
    .soft(result.current.draftSection?.items[0]?.text)
    .toBe("Latest typing");

  // The Lead's next edit is the explicit reconciliation: autosave resumes.
  act(() => {
    result.current.setDraftSection(
      (draft) =>
        draft && {
          ...draft,
          items: draft.items.map((item) =>
            item.stableId === "55555555-5555-5555-5555-555555555555"
              ? { ...item, text: `${localText}!` }
              : item,
          ),
        },
    );
  });
  expect(result.current.sync.autosave.state).toBe("pending");
  expect(result.current.sync.autosave.dirty).toBe(true);
});

it("retains the edited item if the newer server revision arrives before the conflict response", async () => {
  let rejectSave!: (reason: Error) => void;
  const deferred = new Promise<ReportSectionReadModel>((_resolve, reject) => {
    rejectSave = reject;
  });
  const { wrapper, writePort } = buildAutosaveHarness({
    mutationFn: () => deferred,
  });
  const useTab = () => {
    const [serverSection, setServerSection] = useState(
      section(1, "Other original"),
    );
    const [draftSection, setDraftSection] =
      useState<ReportSectionReadModel | null>(null);
    const sync = useDraftServerSync({
      generation: null,
      receiptScope: "inline-conflict-order-test",
      writePort,
      serverSection,
      reportSectionId: AUTOSAVE_SECTION_ID,
      payload: draftSection && sectionToDraftPayload(draftSection),
      enabled: draftSection !== null,
      localOnlyRows: 0,
      version: serverSection.version,
      setVersionSafe: vi.fn(),
      acceptVersion: () => true,
      setIsSubmitted: () => undefined,
      setDraftSection,
      handleConflict: vi.fn(),
    });
    return { draftSection, setDraftSection, setServerSection, sync };
  };
  const { result } = renderHook(() => useTab(), { wrapper });
  act(() =>
    result.current.setDraftSection(
      (draft) =>
        draft && {
          ...draft,
          items: draft.items.map((item) =>
            item.id === itemId ? { ...item, text: localText } : item,
          ),
        },
    ),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.sync.autosave.forceSave();
  });
  act(() =>
    result.current.setDraftSection(
      (draft) =>
        draft && {
          ...draft,
          items: draft.items.map((item) =>
            item.id === itemId ? { ...item, text: "Latest typing" } : item,
          ),
        },
    ),
  );
  act(() =>
    result.current.setServerSection(section(2, "Other updated on server")),
  );
  await act(async () => {
    rejectSave(new LeadFormWriteError("conflict", "stale version"));
    await saving;
  });
  expect
    .soft(result.current.draftSection?.items[0]?.text)
    .toBe("Latest typing");
  expect
    .soft(result.current.draftSection?.items[1]?.text)
    .toBe("Other updated on server");
  expect.soft(result.current.sync.autosave.state).toBe("error");
});
