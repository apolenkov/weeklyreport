import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function ItemComposer({ reportId }: { readonly reportId: string }) {
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
            draftStore: null,
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

function ItemPage({ reportId }: { readonly reportId: string }) {
  return (
    <OverviewInputProvider>
      <ItemComposer key={reportId} reportId={reportId} />
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
    const page = render(<ItemPage reportId="report-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Open item" }));
    expect(
      screen.getByRole("textbox", { name: "Item composer" }),
    ).toBeInTheDocument();

    page.rerender(<ItemPage reportId="report-b" />);
    expect(screen.queryByRole("textbox", { name: "Item composer" })).toBeNull();

    page.rerender(<ItemPage reportId="report-a" />);
    expect(
      screen.getByRole("textbox", { name: "Item composer" }),
    ).toBeInTheDocument();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
});
