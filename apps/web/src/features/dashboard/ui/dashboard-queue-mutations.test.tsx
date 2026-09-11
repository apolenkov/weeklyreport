// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { ReminderDispatchResult } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useMutationMock,
  invalidateQueries,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateReview,
  invalidateSubmissionDashboard,
  mutate,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  invalidateQueries: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidateReview: vi.fn(),
  invalidateSubmissionDashboard: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => useMutationMock(options) as unknown,
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateReview,
  invalidateSubmissionDashboard,
}));
vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    activity: {
      live: { queryOptions: () => ({ queryKey: ["activity.live"] }) },
    },
    leadForm: {
      revoke: {
        mutationOptions: (options: unknown) => ({ kind: "revoke", options }),
      },
    },
    reminders: {
      dispatchPending: {
        mutationOptions: (options: unknown) => ({ kind: "remind", options }),
      },
    },
    review: {
      dashboard: { queryOptions: () => ({ queryKey: ["review.dashboard"] }) },
      verdict: {
        mutationOptions: (options: unknown) => ({ kind: "review", options }),
      },
    },
    weeklyReport: {
      get: { queryOptions: () => ({ queryKey: ["weeklyReport.get"] }) },
    },
  }),
}));
vi.mock("../../../shared/ui/dialogs/confirmation-dialog", () => ({
  ConfirmationDialog: ({
    open,
    onConfirm,
  }: {
    readonly open: boolean;
    readonly onConfirm: () => void;
  }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirm revoke
      </button>
    ) : null,
}));

import { RemindLeadButton } from "./remind-lead-button";
import { RequestChangesButton } from "./request-changes-button";
import { RevokeLeadButton } from "./revoke-lead-button";

const RULE_ID = "40000000-0000-4000-8000-000000000001";

interface MockMutationOptions {
  readonly kind: "remind" | "review" | "revoke";
  readonly options?: MutationCallbacks | undefined;
}

interface MutationCallbacks {
  readonly onSuccess: (result: unknown) => void;
  readonly onError: (error: Error) => void;
}

function callbacksFor(
  configuration: MockMutationOptions,
  callOptions?: MutationCallbacks,
): MutationCallbacks {
  const callbacks = callOptions ?? configuration.options;
  if (!callbacks) throw new Error("Mutation callbacks are required");
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
  useMutationMock.mockImplementation((configuration: MockMutationOptions) => ({
    isPending: false,
    mutate: (input: unknown, callOptions?: MutationCallbacks) => {
      mutate(input);
      const result =
        configuration.kind === "remind"
          ? { queued: 1, alreadyRequested: 0, failed: 0, skipped: 0 }
          : configuration.kind === "review"
            ? { verdict: "changes_requested", unsubmitted: true }
            : undefined;
      callbacksFor(configuration, callOptions).onSuccess(result);
    },
  }));
});

describe("dashboard queue mutation transitions", () => {
  it("refreshes all queue sources after a per-lead reminder", () => {
    const onMutated = vi.fn();
    render(
      <RemindLeadButton
        reportId="10000000-0000-4000-8000-000000000001"
        ruleId={RULE_ID}
        leadId="20000000-0000-4000-8000-000000000001"
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send reminder/i }));
    expect(mutate).toHaveBeenCalledWith({
      reportId: "10000000-0000-4000-8000-000000000001",
      ruleId: RULE_ID,
      leadId: "20000000-0000-4000-8000-000000000001",
    });
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "shows no matched sections",
      result: {
        reason: "no-matching-section",
        queued: 0,
        alreadyRequested: 0,
        failed: 0,
        skipped: 0,
      },
      label: "No sections matched",
    },
    {
      name: "shows a queued reminder",
      result: {
        queued: 1,
        alreadyRequested: 0,
        failed: 0,
        skipped: 0,
      },
      label: "Queued",
    },
    {
      name: "shows an already-requested reminder",
      result: {
        queued: 0,
        alreadyRequested: 1,
        failed: 0,
        skipped: 0,
      },
      label: "Already requested",
    },
  ] satisfies readonly {
    readonly name: string;
    readonly result: ReminderDispatchResult;
    readonly label: string;
  }[])("$name and disables repeat dispatch", ({ result, label }) => {
    const onMutated = vi.fn();
    useMutationMock.mockImplementation(
      (configuration: MockMutationOptions) => ({
        isPending: false,
        mutate: (_input: unknown, callOptions?: MutationCallbacks) =>
          callbacksFor(configuration, callOptions).onSuccess(result),
      }),
    );
    render(
      <RemindLeadButton
        reportId="10000000-0000-4000-8000-000000000001"
        ruleId={RULE_ID}
        leadId="20000000-0000-4000-8000-000000000001"
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Send reminder to Alice Lead",
    });
    fireEvent.click(button);

    expect(button).toHaveTextContent(label);
    expect(button).toBeDisabled();
    expect(onMutated).toHaveBeenCalledOnce();
  });

  it("shows a retry state after a reminder error", () => {
    const onMutated = vi.fn();
    useMutationMock.mockImplementation(
      (configuration: MockMutationOptions) => ({
        isPending: false,
        mutate: (_input: unknown, callOptions?: MutationCallbacks) =>
          callbacksFor(configuration, callOptions).onError(
            new Error("Dispatch failed"),
          ),
      }),
    );
    render(
      <RemindLeadButton
        reportId="10000000-0000-4000-8000-000000000001"
        ruleId={RULE_ID}
        leadId="20000000-0000-4000-8000-000000000001"
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Send reminder to Alice Lead",
    });
    fireEvent.click(button);

    expect(button).toHaveTextContent("Retry");
    expect(button).toBeEnabled();
    expect(onMutated).not.toHaveBeenCalled();
  });

  it("keeps retry available when a completed mutation reports an enqueue failure", () => {
    const onMutated = vi.fn();
    useMutationMock.mockImplementation(
      (configuration: MockMutationOptions) => ({
        isPending: false,
        mutate: (_input: unknown, callOptions?: MutationCallbacks) =>
          callbacksFor(configuration, callOptions).onSuccess({
            queued: 0,
            alreadyRequested: 0,
            failed: 1,
            skipped: 0,
          } satisfies ReminderDispatchResult),
      }),
    );
    render(
      <RemindLeadButton
        reportId="10000000-0000-4000-8000-000000000001"
        ruleId={RULE_ID}
        leadId="20000000-0000-4000-8000-000000000001"
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Send reminder to Alice Lead",
    });
    fireEvent.click(button);
    expect(button).toHaveTextContent("Retry");
    expect(button).toBeEnabled();
    expect(
      screen.getByText("Reminder to Alice Lead failed; retry available"),
    ).toBeInTheDocument();
    expect(button.querySelector(".lucide-check")).toBeNull();
    expect(onMutated).toHaveBeenCalledOnce();
  });

  it("posts the existing changes-requested verdict and refreshes the queue", () => {
    const onMutated = vi.fn();
    render(
      <RequestChangesButton
        reportSectionId="30000000-0000-4000-8000-000000000001"
        version={4}
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request Changes" }));
    expect(mutate).toHaveBeenCalledWith({
      reportSectionId: "30000000-0000-4000-8000-000000000001",
      verdict: "changes_requested",
      version: 4,
    });
    expect(invalidateReview).toHaveBeenCalledTimes(1);
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it("refreshes lead, dashboard and history projections after per-lead revoke", () => {
    const onMutated = vi.fn();
    render(
      <RevokeLeadButton
        reportSectionId="30000000-0000-4000-8000-000000000001"
        leadName="Alice Lead"
        onMutated={onMutated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /revoke alice/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
    expect(mutate).toHaveBeenCalledWith({
      reportSectionId: "30000000-0000-4000-8000-000000000001",
    });
    expect(invalidateLeadForm).toHaveBeenCalledTimes(1);
    expect(invalidateLeadHistory).toHaveBeenCalledTimes(1);
    expect(invalidateSubmissionDashboard).toHaveBeenCalledTimes(1);
    expect(onMutated).toHaveBeenCalledTimes(1);
  });
});
