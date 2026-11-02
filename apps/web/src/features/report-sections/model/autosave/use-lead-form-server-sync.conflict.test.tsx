import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { LeadFormWriteError } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import {
  AUTOSAVE_SECTION_ID as SECTION_ID,
  buildAutosaveHarness as buildHarness,
} from "./use-lead-form-autosave-harness";
import { useDraftServerSync } from "./use-lead-form-server-sync";

const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const ITEM_ID = "44444444-4444-4444-4444-444444444444";
const STABLE_ID = "55555555-5555-5555-5555-555555555555";

// One item in the given placement; the other tab moved it there and back, so
// the server content equals the base while its version has moved on.
function sectionAt(
  version: number,
  type: "current" | "next",
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    version,
    items: [
      {
        id: ITEM_ID,
        stableId: STABLE_ID,
        projectId: PROJECT_ID,
        activityId: null,
        type,
        text: "Current work",
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

function setup({ refetchOnConflict = true } = {}) {
  const { wrapper, calls, writePort } = buildHarness({
    mutationFn: () =>
      Promise.reject(new LeadFormWriteError("conflict", "stale version")),
  });
  // The refetch after a 409 returns the section at version 3 with the base
  // content. Only the conflict handler moves it, like the real refetch does.
  const handleConflict = vi.fn();
  const useTab = () => {
    const [serverSection, setServerSection] =
      useState<ReportSectionReadModel | null>(sectionAt(1, "current"));
    const [draftSection, setDraftSection] =
      useState<ReportSectionReadModel | null>(null);
    const sync = useDraftServerSync({
      generation: null,
      receiptScope: "tab-under-test",
      writePort,
      serverSection,
      reportSectionId: SECTION_ID,
      payload:
        draftSection === null ? null : sectionToDraftPayload(draftSection),
      enabled: draftSection !== null,
      localOnlyRows: 0,
      version: serverSection?.version ?? 1,
      setVersionSafe: vi.fn(),
      acceptVersion: () => true,
      setIsSubmitted: () => undefined,
      setDraftSection,
      handleConflict: () => {
        handleConflict();
        if (refetchOnConflict) setServerSection(sectionAt(3, "current"));
      },
    });
    return {
      draftSection,
      setDraftSection,
      serverSection,
      setServerSection,
      sync,
    };
  };
  return { calls, handleConflict, useTab, wrapper };
}

describe("useDraftServerSync — stale-tab conflict with unchanged content", () => {
  it("replaces a moved draft with the server copy after a 409, even when the content matches the base", async () => {
    const { calls, handleConflict, useTab, wrapper } = setup();
    const { result } = renderHook(() => useTab(), { wrapper });
    // The first delivery adopts the saved section as the draft baseline.
    expect(result.current.draftSection?.items[0]?.type).toBe("current");

    act(() => {
      result.current.setDraftSection(sectionAt(1, "next"));
    });
    await act(async () => {
      await result.current.sync.autosave.forceSave();
    });

    // The move was refused as stale; the conflict handler refetched once.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.items[0]?.type).toBe("next");
    expect(handleConflict).toHaveBeenCalledTimes(1);
    expect(result.current.serverSection?.version).toBe(3);

    // The card returns to the saved placement, not the refused local move.
    expect(result.current.draftSection?.items[0]?.type).toBe("current");

    // The next autosave has nothing to send, so the move never reaches the server.
    await act(async () => {
      await result.current.sync.autosave.forceSave();
    });
    expect(calls).toHaveLength(1);
    expect(handleConflict).toHaveBeenCalledTimes(1);
  });

  it("reverts to a newer server copy that arrived before the refused save answered", async () => {
    const { calls, useTab, wrapper } = setup({ refetchOnConflict: false });
    const { result } = renderHook(() => useTab(), { wrapper });

    act(() => {
      result.current.setDraftSection(sectionAt(1, "next"));
    });
    // The other tab's v3 lands first; its content equals this tab's base, so
    // the local move stays on screen until the save answers.
    act(() => {
      result.current.setServerSection(sectionAt(3, "current"));
    });
    expect(result.current.draftSection?.items[0]?.type).toBe("next");

    // The save is refused; the refetch returns the same v3 and so changes
    // nothing, yet the card must already show the server placement.
    await act(async () => {
      await result.current.sync.autosave.forceSave();
    });
    expect(calls).toHaveLength(1);
    expect(result.current.draftSection?.items[0]?.type).toBe("current");

    await act(async () => {
      await result.current.sync.autosave.forceSave();
    });
    expect(calls).toHaveLength(1);
  });

  it("keeps a local move when a same-content delivery arrives without a conflict", () => {
    const { calls, handleConflict, useTab, wrapper } = setup();
    const { result } = renderHook(() => useTab(), { wrapper });

    act(() => {
      result.current.setDraftSection(sectionAt(1, "next"));
    });
    // A version bump with the base content and no 409 is not a reseed trigger.
    act(() => {
      result.current.setServerSection(sectionAt(2, "current"));
    });

    expect(result.current.draftSection?.items[0]?.type).toBe("next");
    expect(calls).toHaveLength(0);
    expect(handleConflict).not.toHaveBeenCalled();
  });
});
