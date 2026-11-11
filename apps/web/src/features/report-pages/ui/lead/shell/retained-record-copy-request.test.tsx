import "@testing-library/jest-dom/vitest";

import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RetainedIncompleteRecordsOutput } from "@weeklyreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusOverviewModel } from "../../../../report-sections";
import {
  makeDraftMergeSection,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { RetainedRecordCopyRequest } from "./retained-record-copy-request";
import type { ReadyEditor } from "./use-overview-controller";

const mocks = vi.hoisted(() => ({
  query: new URLSearchParams(),
  role: "lead",
  replace: vi.fn(),
  read: vi.fn<() => Promise<RetainedIncompleteRecordsOutput>>(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.query,
  usePathname: () => "/lead/report/current",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("../../../../../shared/lib/auth/session-provider", () => ({
  useSession: () => ({ user: { id: "actor", role: mocks.role } }),
}));
vi.mock("../../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    leadForm: {
      retainedIncompleteRecords: {
        queryOptions: (input: unknown) => ({
          queryKey: ["private-copy", input],
          queryFn: mocks.read,
          retry: false,
        }),
      },
    },
  }),
}));

const reportId = "10000000-0000-4000-8000-000000000001";
const reportSectionId = "10000000-0000-4000-8000-000000000002";
const stableId = "10000000-0000-4000-8000-000000000003";
const available: RetainedIncompleteRecordsOutput = {
  status: "available",
  reportId,
  reportSectionId,
  periodStart: new Date("2026-05-11"),
  periodEnd: new Date("2026-05-17"),
  readOnlyReason: "archived",
  decisions: [],
  risks: [
    {
      stableId,
      projectId: PROJECT_ID,
      risk: "Private source risk",
      impact: null,
      mitigation: "Existing detail",
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ],
};
const props = {
  editor: {
    draft: { section: makeDraftMergeSection() },
    view: { viewModel: { isReadOnly: false } },
  } as unknown as ReadyEditor,
  model: {
    units: [
      {
        kind: "product",
        id: PROJECT_ID,
        name: "Current product",
        historical: false,
      },
    ],
  } as unknown as StatusOverviewModel,
  pendingInput: false,
  onOpen: vi.fn(() => true),
};
function setup(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const child = <RetainedRecordCopyRequest {...props} />;
  const view = render(
    <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  return {
    ...view,
    refresh: () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <RetainedRecordCopyRequest {...props} />
        </QueryClientProvider>,
      ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "lead";
  mocks.query = new URLSearchParams({
    copyReportId: reportId,
    copySectionId: reportSectionId,
    copyKind: "risk",
    copyStableId: stableId,
    feedback: "keep",
  });
  mocks.read.mockResolvedValue(available);
});

afterEach(() => onlineManager.setOnline(true));

describe("authorized recovery source at the current report", () => {
  it("keeps an offline cached source hidden until a new authorization read settles", async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient();
    client.setQueryData(
      ["private-copy", { reportId, reportSectionId }],
      available,
    );
    mocks.read.mockResolvedValue({ status: "unavailable" });
    setup(client);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(screen.queryByText("Private source risk")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/reconnect/i);
    act(() => onlineManager.setOnline(true));
    expect(
      await screen.findByText("This retained draft is no longer available."),
    ).toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("retains the chosen destination while checking the source again", async () => {
    const client = new QueryClient();
    setup(client);
    await screen.findByText("Private source risk");
    const select = screen.getByRole("combobox", { name: "Add to" });
    await userEvent.selectOptions(select, `product:${PROJECT_ID}`);
    const read = Promise.withResolvers<RetainedIncompleteRecordsOutput>();
    mocks.read.mockReturnValue(read.promise);
    act(() => {
      void client.invalidateQueries().catch(() => undefined);
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review copied risk" }),
      ).toBeDisabled(),
    );
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue(`product:${PROJECT_ID}`);
    await act(async () => {
      read.resolve(available);
      await read.promise;
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review copied risk" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("combobox", { name: "Add to" })).toBe(select);
    expect(select).toHaveValue(`product:${PROJECT_ID}`);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("re-reads the source and consumes only its URL intent after explicit opening", async () => {
    setup();
    expect(await screen.findByText("Private source risk")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This report is archived, so these drafts are read-only.",
      ),
    ).toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Add to" }),
      `product:${PROJECT_ID}`,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Review copied risk" }),
    );
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/lead/report/current?feedback=keep",
      { scroll: false },
    );
    expect(screen.queryByText("Private source risk")).not.toBeInTheDocument();
  });

  it("does not expose cached source text while its fresh authorization read is pending", async () => {
    const read = Promise.withResolvers<RetainedIncompleteRecordsOutput>();
    mocks.read.mockReturnValue(read.promise);
    const client = new QueryClient();
    client.setQueryData(
      ["private-copy", { reportId, reportSectionId }],
      available,
    );
    setup(client);
    expect(screen.queryByText("Private source risk")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    await act(async () => {
      read.resolve({ status: "unavailable" });
      await read.promise;
    });
    expect(
      await screen.findByText("This retained draft is no longer available."),
    ).toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("does not read an invalid or duplicated source request", () => {
    mocks.query.append("copyStableId", stableId);
    setup();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("can dismiss an unresolved source without opening input on a late response", async () => {
    const read = Promise.withResolvers<RetainedIncompleteRecordsOutput>();
    mocks.read.mockReturnValue(read.promise);
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss copy" }));
    await act(async () => {
      read.resolve(available);
      await read.promise;
    });
    expect(screen.queryByText("Private source risk")).not.toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("hides a late source response after observed authoring-role loss", async () => {
    const read = Promise.withResolvers<RetainedIncompleteRecordsOutput>();
    mocks.read.mockReturnValue(read.promise);
    const view = setup();
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    mocks.role = "viewer";
    view.refresh();
    await act(async () => {
      read.resolve(available);
      await read.promise;
    });
    expect(screen.queryByText("Private source risk")).not.toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
  });
});
