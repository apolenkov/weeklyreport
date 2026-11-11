import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import {
  OverviewInputProvider,
  useRetainedOverviewState,
} from "./overview-input-provider";
import type { OverviewRecordState } from "./overview-record-state";

const session = vi.hoisted(() => ({ user: { id: "first-user" } }));
vi.mock("../../../../../shared/lib/auth/session-provider", () => ({
  useSession: () => session,
}));

function initialState(reportId: string): OverviewRecordState {
  const value = {
    text: "",
    impact: null,
    mitigation: null,
    severity: "at-risk" as const,
    stageNames: [],
  };
  return {
    kind: "risk",
    parent: { kind: "activity", id: "activity", name: "Activity" },
    identity: { id: "client-id", stableId: "lineage-id" },
    generation: `${reportId}:section`,
    reportSectionId: "section",
    receiptScope: "activation",
    value,
    initial: value,
    baseline: null,
    submission: null,
    errors: {},
    message: null,
  };
}

function Composer({ reportId }: { readonly reportId: string }) {
  const [state, setState] = useRetainedOverviewState("record", reportId);
  return (
    <>
      <button onClick={() => setState(initialState(reportId))}>Open</button>
      <button onClick={() => setState(null)}>Close</button>
      {state ? (
        <>
          <span>{state.identity.stableId}</span>
          <textarea
            aria-label="Risk input"
            value={state.value.text}
            onChange={(event) => {
              const text = event.target.value;
              setState((current) =>
                current?.kind === "risk"
                  ? { ...current, value: { ...current.value, text } }
                  : current,
              );
            }}
          />
        </>
      ) : null}
    </>
  );
}

function Page({ reportId }: { readonly reportId: string | null }) {
  return (
    <OverviewInputProvider>
      {reportId ? (
        <Composer key={reportId} reportId={reportId} />
      ) : (
        <p>Another page</p>
      )}
    </OverviewInputProvider>
  );
}

function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  session.user = { id: "first-user" };
});

it("retains record input and identity across navigation, isolated by report and session", () => {
  const page = render(<Page reportId="first" />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  expect(unloadPrevented()).toBe(false);
  fireEvent.change(screen.getByLabelText("Risk input"), {
    target: { value: "Unsent private risk" },
  });
  expect(unloadPrevented()).toBe(true);
  page.rerender(<Page reportId={null} />);
  expect(unloadPrevented()).toBe(true);
  page.rerender(<Page reportId="second" />);
  expect(screen.queryByLabelText("Risk input")).not.toBeInTheDocument();
  page.rerender(<Page reportId="first" />);
  expect(screen.getByLabelText("Risk input")).toHaveValue(
    "Unsent private risk",
  );
  expect(screen.getByText("lineage-id")).toBeInTheDocument();
  session.user = { id: "second-user" };
  page.rerender(<Page reportId="first" />);
  expect(screen.queryByLabelText("Risk input")).not.toBeInTheDocument();
  expect(unloadPrevented()).toBe(false);
});

it("releases the leave guard after cancelling an unsent record", () => {
  render(<Page reportId="first" />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.change(screen.getByLabelText("Risk input"), {
    target: { value: "Unsent risk" },
  });
  expect(unloadPrevented()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(unloadPrevented()).toBe(false);
});
