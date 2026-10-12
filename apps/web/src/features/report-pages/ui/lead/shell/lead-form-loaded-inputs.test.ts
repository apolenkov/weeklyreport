import type {
  ReopenBlockedReason,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import {
  type LeadFormLoadingState,
  leadFormViewModelInput,
  resolveLeadFormLoaded,
} from "./lead-form-loaded-inputs";

function section(reportId: string, reportSectionId: string) {
  return { reportId, reportSectionId } as ReportSectionReadModel;
}

function loadedState(
  serverSection: ReportSectionReadModel,
): LeadFormLoadingState {
  return {
    isLoading: false,
    awaitingRoleRedirect: false,
    awaitingCanonicalRedirect: false,
    activeData: serverSection,
    byPeriodData: {
      section: serverSection,
      readOnly: false,
      canRequestReopen: false,
      publishedLineage: { itemStableIds: [], decisionStableIds: [] },
    },
    historyData: [],
  };
}

describe("resolveLeadFormLoaded generation gate", () => {
  it("rejects a previous-generation draft on the first report B render", () => {
    const reportA = section("report-a", "section-a");
    const reportB = section("report-b", "section-b");

    expect(resolveLeadFormLoaded(loadedState(reportB), reportA)).toBeNull();
    expect(resolveLeadFormLoaded(loadedState(reportB), reportB)).toMatchObject({
      draftSection: reportB,
      byPeriodData: { section: reportB },
    });
  });

  it("does not substitute the draft for a missing active section", () => {
    const serverSection = section("report-a", "section-a");

    // getActive settled to null (no active binding) while the pinned byPeriod
    // read succeeded: the resolver must NOT fabricate an `active` from the draft.
    expect(
      resolveLeadFormLoaded(
        { ...loadedState(serverSection), activeData: null },
        serverSection,
      ),
    ).toBeNull();
  });
});

describe("leadFormViewModelInput pending reopen", () => {
  const data = {
    crossAuthors: [],
    foreignContent: undefined,
    isEveryone: false,
    visibilityHydrated: true,
    isForeignSlidesDeck: false,
  };
  const presentation = {
    isSubmitted: true,
    selectedPeriodId: null,
    showArchivePeriods: false,
  };
  const inputFor = (reopenBlockedReason: ReopenBlockedReason | null) => {
    const serverSection = section("report-a", "section-a");
    const state = loadedState(serverSection);
    const bundle = resolveLeadFormLoaded(
      {
        ...state,
        byPeriodData: {
          section: serverSection,
          readOnly: false,
          canRequestReopen: false,
          reopenBlockedReason,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        },
      },
      serverSection,
    );
    return leadFormViewModelInput(data, expectDefined(bundle), presentation);
  };

  it("flags a pending request only for the pending_request_exists reason", () => {
    expect(inputFor("pending_request_exists").hasPendingReopen).toBe(true);
    expect(inputFor("period_closed").hasPendingReopen).toBe(false);
    expect(inputFor(null).hasPendingReopen).toBe(false);
  });
});
