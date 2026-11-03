// Submission-filter and empty-state behavior through the page harness.

import { vi } from "vitest";

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();

import type { ReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  AUTHOR_ID_A,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";

// Submitted|All filters the rendered accordion only; header/portfolio/nav stay
// on full truth. Default submitted-only for access-holders on a live period.
const AUTHOR_ID_B = "11111111-1111-4111-8111-bbbbbbbbbbbb";

function submittedSection(): ReportSectionFixture {
  return {
    reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_A,
    authorName: "Alice",
    status: "submitted" as const,
    submittedAt: new Date("2026-04-14T09:00:00Z"),
    projects: [
      {
        projectId: PRODUCT_ID_A,
        projectName: "Product Alpha",
        trafficLight: "green",
      },
    ],
    items: [
      {
        id: "33333333-3333-4333-8333-aaaaaaaaaa01",
        projectId: PRODUCT_ID_A,
        type: "current" as const,
        text: "Alice submitted work",
        tag: "Dev",
        workflowStatus: "done" as const,
        stageNames: ["Development"],
        carriedOver: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
  };
}

function draftSection(): ReportSectionFixture {
  return {
    reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_B,
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
    projects: [
      {
        projectId: PRODUCT_ID_B,
        projectName: "Product Beta",
        trafficLight: "green",
      },
    ],
    items: [
      {
        id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
        projectId: PRODUCT_ID_B,
        type: "current" as const,
        text: "Bob draft work",
        tag: "Dev",
        workflowStatus: "in_progress" as const,
        stageNames: ["Development"],
        carriedOver: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
  };
}

const TWO_PRODUCT_OVERVIEW = [
  {
    productId: PRODUCT_ID_A,
    productName: "Product Alpha",
    worstStatus: "green" as const,
    stageCount: 1,
    leadNames: ["Alice"],
    leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
  },
  {
    productId: PRODUCT_ID_B,
    productName: "Product Beta",
    worstStatus: "yellow" as const,
    stageCount: 1,
    leadNames: ["Bob"],
    leadIds: ["d4b211c1-c97a-5853-b0e3-68e82c3c1bd7"],
  },
];
export {
  AUTHOR_ID_B,
  draftSection,
  submittedSection,
  toastError,
  toastSuccess,
  TWO_PRODUCT_OVERVIEW,
};
