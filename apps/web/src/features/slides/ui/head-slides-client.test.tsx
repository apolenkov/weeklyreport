// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ActivityQueryResult {
  readonly data:
    { readonly rows: readonly { readonly id: string }[] } | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

const mockActivityQuery = vi.hoisted(() => vi.fn<() => ActivityQueryResult>());

vi.mock("./status-slide-deck", () => ({
  StatusSlideDeck: ({
    slides,
    toolbar,
  }: {
    slides: unknown[];
    toolbar?: ReactNode;
  }) => (
    <div
      data-testid="status-slide-deck"
      data-slide-count={String(slides.length)}
    >
      {toolbar}
      {slides.map((slide) => JSON.stringify(slide)).join(" ")}
    </div>
  ),
}));

vi.mock("./slide-skeleton", () => ({
  SlideSkeleton: () => <div data-testid="slide-skeleton" />,
}));

vi.mock("../../../shared/hooks/query/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

// One activity row maps to one slide; identity sort keeps the count stable so
// the assertion is on enableActivity gating, not the slide-building internals.
vi.mock("../model/activity-slide-model", () => ({
  buildActivitySlideModel: (row: unknown) => row,
}));
vi.mock("../model/product-scoped-slides", () => ({
  buildProductScopedSlides: (sections: unknown[]) => sections,
}));
vi.mock("../model/section-slide-model", () => ({
  buildSectionSlideModel: (section: unknown) => section,
}));
vi.mock("../model/section-slide-pagination", () => ({
  sortSlidesForReview: (slides: unknown[]) => slides,
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
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
    return mockActivityQuery();
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

beforeEach(() => {
  mockActivityQuery.mockReturnValue({
    data: { rows: ACTIVITY_ROWS },
    isLoading: false,
    isError: false,
  });
});

afterEach(() => {
  vi.mocked(useQuery).mockClear();
  mockActivityQuery.mockClear();
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
    expect(screen.getByTestId("status-slide-deck")).toHaveAttribute(
      "data-slide-count",
      "0",
    );
  });

  it("head (default): activity.live query is enabled and its rows build slides", () => {
    render(<HeadSlidesClient />);
    const activityCall = activityQueryCall();
    expect(activityCall?.enabled).toBe(true);
    expect(screen.getByTestId("status-slide-deck")).toHaveAttribute(
      "data-slide-count",
      String(ACTIVITY_ROWS.length),
    );
  });
});

describe("HeadSlidesClient — density control", () => {
  it("exposes a reversible Document/Presentation state on viewer and head decks", () => {
    render(<HeadSlidesClient reportId="report-a" enableActivity={false} />);
    const document = screen.getByRole("button", { name: "Document" });
    const presentation = screen.getByRole("button", {
      name: "Presentation",
    });

    expect(document).toHaveAttribute("aria-pressed", "true");
    expect(presentation).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(presentation);
    expect(document).toHaveAttribute("aria-pressed", "false");
    expect(presentation).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(document);
    expect(document).toHaveAttribute("aria-pressed", "true");
  });
});

describe("HeadSlidesClient — activity fallback states", () => {
  it("renders populated report slides while activity is loading", () => {
    mockActivityQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<HeadSlidesClient reportId="report-a" />);

    expect(screen.getByText(/Report A slide/)).toBeInTheDocument();
    expect(screen.queryByTestId("slide-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByText("Slides could not load")).not.toBeInTheDocument();
  });

  it("renders populated report slides when activity fails", () => {
    mockActivityQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<HeadSlidesClient reportId="report-a" />);

    expect(screen.getByText(/Report A slide/)).toBeInTheDocument();
    expect(screen.queryByTestId("slide-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByText("Slides could not load")).not.toBeInTheDocument();
  });

  it("shows the skeleton for an empty report while activity is loading", () => {
    mockActivityQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<HeadSlidesClient />);

    expect(screen.getByTestId("slide-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("status-slide-deck")).not.toBeInTheDocument();
  });

  it("shows the error state for an empty report when activity fails", () => {
    mockActivityQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<HeadSlidesClient />);

    expect(screen.getByText("Slides could not load")).toBeInTheDocument();
    expect(screen.queryByTestId("slide-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-slide-deck")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("status-slide-deck")).toBeNull();
  });
});
