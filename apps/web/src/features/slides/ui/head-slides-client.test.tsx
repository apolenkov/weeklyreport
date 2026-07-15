/**
 * @vitest-environment jsdom
 *
 * viewer-report-surface-parity (review P3): HeadSlidesClient's `enableActivity`
 * gate is the load-bearing reason a viewer deck never fires `activity.live` (a
 * head-only / FORBIDDEN-for-viewer procedure). The viewer shell test only
 * asserts the prop pass-through; this suite exercises the gating logic itself:
 *   - the `activity.live` query is created with `enabled: false`, so the
 *     forbidden query never fires for a viewer;
 *   - with no published lead sections, a viewer deck stays empty — the
 *     activity fallback is skipped even when activity rows are available.
 * The default (head) path is also pinned so the gate did not change it.
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./report-slides", () => ({
  ReportSlides: ({ slides }: { slides: unknown[] }) => (
    <div data-testid="report-slides" data-slide-count={String(slides.length)}>
      {slides.map((slide) => JSON.stringify(slide)).join(" ")}
    </div>
  ),
}));

vi.mock("./slide-skeleton", () => ({
  SlideSkeleton: () => <div data-testid="slide-skeleton" />,
}));

vi.mock("../../../lib/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

// One activity row maps to one slide; identity sort keeps the count stable so
// the assertion is on enableActivity gating, not the slide-building internals.
vi.mock("../model/section-slide-utils", () => ({
  buildActivitySlideModel: (row: unknown) => row,
  buildProductScopedSlides: (sections: unknown[]) => sections,
  buildSectionSlideModel: (section: unknown) => section,
  paginateSectionSlides: (model: unknown) => [model],
  sortSlidesForReview: (slides: unknown[]) => slides,
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: {
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
    activity: {
      live: {
        queryOptions: () => ({ queryKey: ["activity.live"] }),
      },
    },
  }),
}));

// A published report with NO lead sections + two activity rows available: the
// only thing standing between the viewer and the forbidden activity fallback is
// the enableActivity gate.
const ACTIVITY_ROWS = [{ id: "a1" }, { id: "a2" }];

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: { queryKey?: unknown[]; enabled?: boolean }) => {
    const key = opts.queryKey?.[0];
    if (key === "weeklyReport.get") {
      if (opts.queryKey?.[1] === "report-b") {
        return { data: undefined, isLoading: true, isError: false };
      }
      return {
        data: {
          status: "active",
          leadSections:
            opts.queryKey?.[1] === "report-a"
              ? [{ id: "report-a-slide", label: "Report A slide" }]
              : [],
        },
        isLoading: false,
        isError: false,
      };
    }
    // activity.live — return rows regardless; the component must ignore them
    // when enableActivity is false.
    return {
      data: { rows: ACTIVITY_ROWS },
      isLoading: false,
      isError: false,
    };
  }),
}));

import { HeadSlidesClient } from "./head-slides-client";

function activityQueryCall() {
  return vi
    .mocked(useQuery)
    .mock.calls.map((call) => call[0])
    .find(
      (opts) =>
        Array.isArray((opts as { queryKey?: unknown[] }).queryKey) &&
        (opts as { queryKey: unknown[] }).queryKey[0] === "activity.live",
    ) as { enabled?: boolean } | undefined;
}

afterEach(() => {
  vi.mocked(useQuery).mockClear();
});

describe("HeadSlidesClient — enableActivity gating", () => {
  it("viewer (enableActivity=false): activity.live query is disabled and never fires", () => {
    render(<HeadSlidesClient enableActivity={false} />);
    const activityCall = activityQueryCall();
    expect(activityCall).toBeDefined();
    expect(activityCall?.enabled).toBe(false);
  });

  it("viewer (enableActivity=false): no activity-derived slides even when rows are present", () => {
    render(<HeadSlidesClient enableActivity={false} />);
    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-slide-count",
      "0",
    );
  });

  it("head (default): activity.live query is enabled and its rows build slides", () => {
    render(<HeadSlidesClient />);
    const activityCall = activityQueryCall();
    expect(activityCall?.enabled).toBe(true);
    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-slide-count",
      String(ACTIVITY_ROWS.length),
    );
  });
});

describe("HeadSlidesClient report-key transitions", () => {
  it("replaces report A slides with the pending skeleton for report B", async () => {
    const rendered = render(
      <HeadSlidesClient reportId="report-a" enableActivity={false} />,
    );
    expect(screen.getByText(/Report A slide/)).toBeInTheDocument();

    rendered.rerender(
      <HeadSlidesClient reportId="report-b" enableActivity={false} />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Report A slide/)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("slide-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("report-slides")).toBeNull();
  });
});
