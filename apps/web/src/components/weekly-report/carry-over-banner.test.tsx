/**
 * @vitest-environment jsdom
 *
 * carry-over banner: the head-view signal on an open period. Renders the
 * prior period's uncarried open work with a one-click "Copy forward unfinished"
 * that runs `carryOver.execute`, self-suppresses when nothing is uncarried, and
 * maps the button click to {sourceReportId (from the query), targetReportId
 * (from the prop)}.
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useQueryMock, useMutationMock, invalidateQueries } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
  useMutation: (...args: unknown[]) => useMutationMock(...args) as unknown,
  useQueryClient: () => ({ invalidateQueries }),
}));

const { toast } = vi.hoisted(() => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast }));

const { invalidateDashboard, invalidateLeadForm } = vi.hoisted(() => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
}));
vi.mock("../../lib/cache-keys", () => ({
  invalidateDashboard,
  invalidateLeadForm,
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    carryOver: {
      uncarried: {
        queryOptions: () => ({ queryKey: ["carryOver.uncarried"] }),
        pathFilter: () => ({ queryKey: ["carryOver.uncarried"] }),
      },
      execute: {
        mutationOptions: (opts: unknown) => opts,
      },
    },
  }),
}));

import { CarryOverBanner } from "./carry-over-banner";

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    stableId: "lineage-1",
    text: "Ship the follow-up",
    authorId: "u1",
    authorName: "Alice Lead",
    ...overrides,
  };
}

function mockUncarried(data: unknown) {
  useQueryMock.mockReturnValue({ data, isPending: false, isError: false });
}

beforeEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
  invalidateQueries.mockReset();
  invalidateDashboard.mockReset();
  invalidateLeadForm.mockReset();
  toast.info.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  useMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("CarryOverBanner", () => {
  it("renders nothing while the query is still loading", () => {
    mockUncarried(undefined);
    const { container } = render(<CarryOverBanner reportId="target-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no prior source period", () => {
    mockUncarried({ sourceReportId: null, items: [], decisions: [] });
    const { container } = render(<CarryOverBanner reportId="target-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when nothing is uncarried", () => {
    mockUncarried({ sourceReportId: "source-1", items: [], decisions: [] });
    const { container } = render(<CarryOverBanner reportId="target-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the singular summary for exactly one uncarried record", () => {
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord()],
      decisions: [],
    });
    render(<CarryOverBanner reportId="target-1" />);

    const banner = screen.getByTestId("carry-over-banner");
    expect(banner.textContent).toMatch(/1 planned item\b/);
    expect(banner.textContent).not.toMatch(/1 planned items/);
    expect(banner.textContent).toMatch(/has not been copied into this period/);
  });

  it("renders the plural summary joining items and decisions", () => {
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord(), makeRecord({ stableId: "lineage-2" })],
      decisions: [makeRecord({ stableId: "lineage-3", text: "Pick a vendor" })],
    });
    render(<CarryOverBanner reportId="target-1" />);

    const banner = screen.getByTestId("carry-over-banner");
    expect(banner.textContent).toMatch(
      /2 planned items and 1 pending decision\b/,
    );
    expect(banner.textContent).toMatch(/have not been copied into this period/);
  });

  it("runs carryOver.execute with the query's source and the prop's target on click", () => {
    const mutate = vi.fn();
    useMutationMock.mockReturnValue({ mutate, isPending: false });
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord()],
      decisions: [],
    });
    render(<CarryOverBanner reportId="target-1" />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy forward unfinished/i }),
    );

    expect(mutate).toHaveBeenCalledWith({
      sourceReportId: "source-1",
      targetReportId: "target-1",
    });
  });

  it("shows the pending affordance while the mutation is in flight", () => {
    useMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: true });
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord()],
      decisions: [],
    });
    render(<CarryOverBanner reportId="target-1" />);

    const button = screen.getByRole("button", { name: /copying/i });
    expect(button).toBeDisabled();
  });

  it("invalidates the dependent caches and reports what moved on success", () => {
    let capturedOnSuccess:
      | ((result: { records: unknown[] }) => void)
      | undefined;
    useMutationMock.mockImplementation(
      (opts: { onSuccess?: (result: { records: unknown[] }) => void }) => {
        capturedOnSuccess = opts.onSuccess;
        return { mutate: vi.fn(), isPending: false };
      },
    );
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord()],
      decisions: [],
    });
    render(<CarryOverBanner reportId="target-1" />);

    capturedOnSuccess?.({ records: [{ id: "rec-1" }] });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["carryOver.uncarried"],
    });
    expect(invalidateDashboard).toHaveBeenCalledTimes(1);
    expect(invalidateLeadForm).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("reports a no-op when the execution moves no records", () => {
    let capturedOnSuccess:
      | ((result: { records: unknown[] }) => void)
      | undefined;
    useMutationMock.mockImplementation(
      (opts: { onSuccess?: (result: { records: unknown[] }) => void }) => {
        capturedOnSuccess = opts.onSuccess;
        return { mutate: vi.fn(), isPending: false };
      },
    );
    mockUncarried({
      sourceReportId: "source-1",
      items: [makeRecord()],
      decisions: [],
    });
    render(<CarryOverBanner reportId="target-1" />);

    capturedOnSuccess?.({ records: [] });

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
