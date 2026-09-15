import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../../../../report-sections";
import { StatusOverviewItemPreview } from "../../../../report-sections/ui/status-overview-item-preview";
import {
  OverviewInputProvider,
  useRetainedOverviewQuickEdits,
  useRetainedOverviewState,
} from "./overview-input-provider";
import type { OverviewPlanState } from "./overview-plan-command";

const session = vi.hoisted(() => ({ user: { id: "first-user" } }));
vi.mock("../../../../../shared/lib/auth/session-provider", () => ({
  useSession: () => session,
}));

function Composer({ reportId }: { readonly reportId: string }) {
  const [value, setValue] = useRetainedOverviewState("plan", reportId);
  return (
    <>
      <span>{value?.fields.reason ?? "No retained input"}</span>
      <button
        onClick={() =>
          setValue({
            fields: { reason: "Retained reason" },
          } as OverviewPlanState)
        }
      >
        Type
      </button>
      <button onClick={() => setValue(null)}>Clear</button>
    </>
  );
}

function Page({ reportId }: { readonly reportId: string | null }) {
  return (
    <OverviewInputProvider>
      {reportId ? (
        <Composer key={reportId} reportId={reportId} />
      ) : (
        <span>Other page</span>
      )}
    </OverviewInputProvider>
  );
}

const currentItem: StatusOverviewItem = {
  key: "item-1:current",
  recordId: "item-1",
  source: "current",
  editTarget: { recordId: "item-1", source: "current" },
  stableId: "stable-1",
  text: "Original text",
  tag: "feature",
  stageNames: [],
  pausedReason: null,
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};
const nextProjection: StatusOverviewItem = {
  ...currentItem,
  key: "item-1:next-step",
  source: "next",
  editTarget: {
    recordId: "item-1",
    source: "current",
    focusNextStep: true,
  },
};
const otherRecord: StatusOverviewItem = {
  ...currentItem,
  key: "item-2:current",
  recordId: "item-2",
  editTarget: { recordId: "item-2", source: "current" },
  stableId: "stable-2",
};

function QuickEdit({
  reportId,
  item,
}: {
  readonly reportId: string;
  readonly item: StatusOverviewItem;
}) {
  const quickEditMemory = useRetainedOverviewQuickEdits(reportId);
  return (
    <StatusOverviewItemPreview
      item={item}
      onQuickEditText={vi.fn()}
      quickEditMemory={quickEditMemory}
    />
  );
}

function QuickEditPage({
  reportId,
  item,
}: {
  readonly reportId: string;
  readonly item: StatusOverviewItem;
}) {
  return (
    <OverviewInputProvider>
      <QuickEdit
        key={`${reportId}:${item.key}`}
        reportId={reportId}
        item={item}
      />
    </OverviewInputProvider>
  );
}

describe("overview session input retention", () => {
  beforeEach(() => {
    session.user = { id: "first-user" };
  });

  it("recovers after route unmount without leaking into another report", () => {
    const page = render(<Page reportId="first" />);
    fireEvent.click(screen.getByText("Type"));
    page.rerender(<Page reportId={null} />);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    page.rerender(<Page reportId="second" />);
    expect(screen.getByText("No retained input")).toBeInTheDocument();
    page.rerender(<Page reportId="first" />);
    expect(screen.getByText("Retained reason")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    page.rerender(<Page reportId={null} />);
    const cleared = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleared);
    expect(cleared.defaultPrevented).toBe(false);
  });

  it("drops old input when the authenticated user changes, including a later return", () => {
    const page = render(<Page reportId="first" />);
    fireEvent.click(screen.getByText("Type"));
    session.user = { id: "second-user" };
    page.rerender(<Page reportId="first" />);
    expect(screen.getByText("No retained input")).toBeInTheDocument();
    session.user = { id: "first-user" };
    page.rerender(<Page reportId="first" />);
    expect(screen.getByText("No retained input")).toBeInTheDocument();
  });

  it("retains a quick edit through A to B to A navigation without crossing report or projection", () => {
    const page = render(
      <QuickEditPage reportId="report-a" item={currentItem} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Quick edit/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Unsaved current result" },
    });

    page.rerender(<QuickEditPage reportId="report-b" item={currentItem} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Original text")).toBeInTheDocument();

    page.rerender(<QuickEditPage reportId="report-a" item={otherRecord} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Original text")).toBeInTheDocument();

    page.rerender(<QuickEditPage reportId="report-a" item={nextProjection} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Original text")).toBeInTheDocument();

    page.rerender(<QuickEditPage reportId="report-a" item={currentItem} />);
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved current result");

    page.rerender(
      <QuickEditPage
        reportId="report-a"
        item={{
          ...currentItem,
          recordId: "replacement-record",
          editTarget: { recordId: "replacement-record", source: "current" },
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved current result");

    page.rerender(
      <QuickEditPage
        reportId="report-a"
        item={{ ...currentItem, editTarget: null }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved current result");
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    const cleared = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleared);
    expect(cleared.defaultPrevented).toBe(false);
  });
});
