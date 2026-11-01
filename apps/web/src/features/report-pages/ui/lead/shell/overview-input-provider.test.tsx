import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createItemEditDraftStore } from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import {
  OverviewInputProvider,
  useRetainedOverviewState,
} from "./overview-input-provider";
import type { OverviewPlanState } from "./overview-plan-command";

const session = vi.hoisted(() => ({ user: { id: "first-user" } }));
vi.mock("../../../../../shared/lib/auth/session-provider", () => ({
  useSession: () => session,
}));

function newDraftStore() {
  return createItemEditDraftStore({
    item: null,
    products: [],
    activities: [],
    week: "current",
  });
}

function unloadPrevented(): boolean {
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  return unload.defaultPrevented;
}

function Composer({ reportId }: { readonly reportId: string }) {
  const [value, setValue] = useRetainedOverviewState("plan", reportId);
  return (
    <>
      <span>{value?.fields.reason ?? "No retained input"}</span>
      <button
        onClick={() =>
          setValue({
            fields: { reason: "Retained reason" },
            baseline: { reason: "" },
          } as OverviewPlanState)
        }
      >
        Type
      </button>
      <button
        onClick={() =>
          setValue({
            fields: { reason: "" },
            baseline: { reason: "" },
          } as OverviewPlanState)
        }
      >
        Open pristine
      </button>
      <button onClick={() => setValue(null)}>Clear</button>
    </>
  );
}

function ItemComposer({
  reportId,
  draftStore,
}: {
  readonly reportId: string;
  readonly draftStore: ReturnType<typeof newDraftStore>;
}) {
  const [value, setValue] = useRetainedOverviewState("item", reportId);
  return (
    <>
      {value ? (
        <textarea aria-label="Item composer" defaultValue="Pending item" />
      ) : null}
      <button
        onClick={() =>
          setValue({
            mode: "create",
            generation: `generation:${reportId}`,
            stableId: null,
            week: "current",
            target: {
              source: "current",
              unitKind: "product",
              unitId: "marketing",
            },
            draftStore,
            editorAtOpen: null,
            submission: null,
          } as unknown as OverviewItemDialogState)
        }
      >
        Open item
      </button>
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

function ItemPage({
  reportId,
  draftStore,
}: {
  readonly reportId: string;
  readonly draftStore: ReturnType<typeof newDraftStore>;
}) {
  return (
    <OverviewInputProvider>
      <ItemComposer
        key={reportId}
        reportId={reportId}
        draftStore={draftStore}
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
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    session.user = { id: "first-user" };
    page.rerender(<Page reportId="first" />);
    expect(screen.getByText("No retained input")).toBeInTheDocument();
  });

  it("retains a pending item composer across report navigation", () => {
    const draftStore = newDraftStore();
    const page = render(
      <ItemPage reportId="report-a" draftStore={draftStore} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open item" }));
    draftStore.setters.setText("Pending item");
    expect(
      screen.getByRole("textbox", { name: "Item composer" }),
    ).toBeInTheDocument();

    page.rerender(<ItemPage reportId="report-b" draftStore={draftStore} />);
    expect(screen.queryByRole("textbox", { name: "Item composer" })).toBeNull();

    page.rerender(<ItemPage reportId="report-a" draftStore={draftStore} />);
    expect(
      screen.getByRole("textbox", { name: "Item composer" }),
    ).toBeInTheDocument();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  it("does not warn while a retained item composer is pristine, then warns once it is edited", () => {
    const draftStore = newDraftStore();
    render(<ItemPage reportId="report-a" draftStore={draftStore} />);
    fireEvent.click(screen.getByRole("button", { name: "Open item" }));
    expect(unloadPrevented()).toBe(false);

    draftStore.setters.setText("Typed after opening");
    expect(unloadPrevented()).toBe(true);

    draftStore.setters.setText(draftStore.baseline.text);
    expect(unloadPrevented()).toBe(false);
  });

  it("does not warn while a retained plan composer matches what it opened with", () => {
    render(<Page reportId="first" />);
    fireEvent.click(screen.getByText("Open pristine"));
    expect(unloadPrevented()).toBe(false);

    fireEvent.click(screen.getByText("Type"));
    expect(unloadPrevented()).toBe(true);
  });
});
