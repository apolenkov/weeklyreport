import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
