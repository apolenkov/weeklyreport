import type { UserSession } from "@weeklyreport/shared";
import { vi } from "vitest";

import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import type { CrossAuthorContentRow } from "../../../../report-sections";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

export const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const SECTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const OTHER_USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const PINNED_REPORT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

export function makeSection() {
  return makeLeadFormSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: USER_ID,
  });
}

export function buildTRPC(
  active: unknown = {
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    authorName: "Test Lead",
  },
  failures: { viewSettings?: boolean; crossAuthors?: boolean } = {},
  byPeriodQueryFn?: (input: unknown) => unknown,
  authQueryFn?: () => UserSession | null,
  contentQueryFn?: () =>
    | readonly CrossAuthorContentRow[]
    | Promise<readonly CrossAuthorContentRow[]>,
) {
  const byPeriodSpy = vi.fn();
  const contentSpy = vi.fn();
  const { proxy } = createMockTRPC([
    { path: ["auth", "me"], query: authQueryFn ?? (() => null) },
    { path: ["leadForm", "retainedIncompleteRecords"] },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
    { path: ["reports", "getActive"], query: active },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: failures.viewSettings
        ? Promise.reject(new Error("view settings failed"))
        : { unifiedActivityView: false },
    },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) => {
        byPeriodSpy(input);
        if (byPeriodQueryFn) return byPeriodQueryFn(input);
        return {
          section: makeSection(),
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        };
      },
    },
    {
      path: ["leadForm", "crossAuthors"],
      queryByInput: () =>
        failures.crossAuthors
          ? Promise.reject(new Error("cross authors failed"))
          : [],
    },
    {
      path: ["leadForm", "crossAuthorContent"],
      queryByInput: (input) => {
        contentSpy(input);
        return contentQueryFn ? contentQueryFn() : [];
      },
    },
  ]);
  return { proxy, byPeriodSpy, contentSpy };
}
