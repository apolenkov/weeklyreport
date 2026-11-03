// @vitest-environment jsdom
//
// Head shell routes document actions and context controls into the report
// chrome, plus a header context label beside the title.

import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// The PeriodNavigator (rendered in the toolbar) reads these. Pathname is
// overridden per-test below to point at the addressed head report week.
const mockPathname = vi.fn(() => "/head/report");
const mockSearchParams = vi.fn(() => new URLSearchParams());
const mockReplace = vi.fn();

// Branch the mock on queryKey: compiledHistory vs weeklyReport.get shapes.

const TEST_REPORT_ID = "test-report-001";
export { mockPathname, mockReplace, mockSearchParams, TEST_REPORT_ID };
