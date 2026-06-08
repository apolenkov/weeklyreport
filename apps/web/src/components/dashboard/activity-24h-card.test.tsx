/**
 * @vitest-environment jsdom
 *
 * VA-0a/VA-0b: a11y regression catalog — activity-24h-card.tsx
 * Covers the div→section change that makes this component a named region.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    activity: {
      live: {
        queryOptions: () => ({ queryKey: ["activity.live"] }),
      },
    },
  }),
}));

// Import AFTER mocks are installed.
import { Activity24hCard } from "./activity-24h-card";

const mockUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Helper: produce a row with lastEditAt in the recent past (within 24 h)
// ---------------------------------------------------------------------------
function recentIso(): string {
  return new Date(Date.now() - 60_000).toISOString(); // 1 min ago
}

// Row edited more than 24 hours ago — should NOT be counted.
function staleIso(): string {
  return new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
}

describe("Activity24hCard — VA-0a high unit-rtl + VA-0b snapshot", () => {
  // ── unit-rtl, high ────────────────────────────────────────────────────────

  it("root section has implicit role='region' via section + aria-label", () => {
    mockUseQuery.mockReturnValue({
      data: { rows: [] },
      isLoading: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<Activity24hCard />);

    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("aria-label reflects the computed count when data is available", () => {
    mockUseQuery.mockReturnValue({
      data: {
        rows: [
          { lastEditAt: recentIso() },
          { lastEditAt: recentIso() },
          { lastEditAt: staleIso() }, // outside 24 h — excluded
          { lastEditAt: null }, // null — excluded
        ],
      },
      isLoading: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<Activity24hCard />);

    expect(
      screen.getByRole("region", {
        name: "24h Activity: 2 updates in last 24 hours",
      }),
    ).toBeInTheDocument();
  });

  it("aria-label contains 'loading' while query is in flight", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as UseQueryResult<unknown, unknown>);

    render(<Activity24hCard />);

    expect(
      screen.getByRole("region", {
        name: "24h Activity: loading updates in last 24 hours",
      }),
    ).toBeInTheDocument();
  });

  it("renders the animate-pulse skeleton inside the section while loading", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { container } = render(<Activity24hCard />);

    const section = container.querySelector(
      '[data-testid="activity-24h-card"]',
    );
    const pulse = section?.querySelector(".animate-pulse");
    expect(pulse).toBeInTheDocument();
  });

  it("renders the count value inside the section when data is loaded", () => {
    mockUseQuery.mockReturnValue({
      data: { rows: [{ lastEditAt: recentIso() }] },
      isLoading: false,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { container } = render(<Activity24hCard />);

    const section = container.querySelector(
      '[data-testid="activity-24h-card"]',
    );
    // count "1" must live inside the section element
    expect(section).toHaveTextContent("1");
    expect(screen.getByText("Updates in last 24h")).toBeInTheDocument();
  });

  // ── snapshot, any priority ────────────────────────────────────────────────

  it("snapshot — root section classes and inline style are stable", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { container } = render(<Activity24hCard />);
    const section = container.querySelector(
      '[data-testid="activity-24h-card"]',
    );
    if (!section) throw new Error("activity-24h-card section not found");

    expect({
      className: section.className,
      style: section.getAttribute("style"),
    }).toMatchInlineSnapshot(`
      {
        "className": "rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]",
        "style": "border-left: 3px solid var(--color-starbucks-accent);",
      }
    `);
  });

  it("snapshot — all content is nested inside the section (semantic nesting)", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as UseQueryResult<unknown, unknown>);

    const { container } = render(<Activity24hCard />);
    const section = container.querySelector(
      '[data-testid="activity-24h-card"]',
    );

    // Serialise only the section subtree so the snapshot is scoped and stable.
    expect(section).toMatchInlineSnapshot(`
      <section
        aria-label="24h Activity: loading updates in last 24 hours"
        class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
        data-testid="activity-24h-card"
        style="border-left: 3px solid var(--color-starbucks-accent);"
      >
        <p
          class="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]"
        >
          24h Activity
        </p>
        <div
          class="h-8 w-12 animate-pulse rounded bg-[var(--color-muted)]"
        />
      </section>
    `);
  });
});
