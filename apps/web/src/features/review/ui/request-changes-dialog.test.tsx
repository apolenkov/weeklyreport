// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { reviewVerdictInputSchema } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { RequestChangesDialog } from "./request-changes-dialog";

const SECTION = "11111111-1111-4111-8111-111111111111";

function setup() {
  const onClose = vi.fn<() => void>();
  const onRequested = vi.fn<(result: unknown) => void>();
  const { proxy, captured } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  render(
    <RequestChangesDialog
      reportSectionId={SECTION}
      version={3}
      subjectName="Ada"
      onClose={onClose}
      onRequested={onRequested}
    />,
    { wrapper },
  );
  const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
  return { onClose, onRequested, mutationFn };
}

const submitButton = () =>
  screen.getByRole("button", { name: /Request changes|Requesting/u });

describe("RequestChangesDialog", () => {
  it("focuses the reason field on open", () => {
    setup();
    expect(screen.getByLabelText("Reason for the lead")).toHaveFocus();
  });

  it("blocks an empty reason with an inline error and sends nothing", async () => {
    const { mutationFn } = setup();
    await userEvent.type(
      screen.getByLabelText("Reason for the lead"),
      " ".repeat(3),
    );
    await userEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a reason for the lead.",
    );
    expect(screen.getByLabelText("Reason for the lead")).toBeInvalid();
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason with the version, then reports and closes", async () => {
    const { mutationFn, onRequested, onClose } = setup();
    const result = {
      verdict: "changes_requested",
      judgedVersion: 3,
      unsubmitted: true,
    };
    mutationFn.mockResolvedValue(result);
    await userEvent.type(
      screen.getByLabelText("Reason for the lead"),
      "  Add a risk owner.  ",
    );
    await userEvent.click(submitButton());
    await waitFor(() => {
      expect(onRequested).toHaveBeenCalledWith(result);
    });
    expect(mutationFn.mock.calls[0]?.[0]).toEqual({
      reportSectionId: SECTION,
      verdict: "changes_requested",
      version: 3,
      comment: "Add a risk owner.",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog and typed text when the server rejects the request", async () => {
    const { mutationFn, onClose } = setup();
    mutationFn.mockRejectedValue(new Error("The section changed."));
    await userEvent.type(screen.getByLabelText("Reason for the lead"), "Fix X");
    await userEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The section changed.",
    );
    expect(screen.getByLabelText("Reason for the lead")).toHaveValue("Fix X");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Cancel without mutating", async () => {
    const { mutationFn, onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it("disables submit while pending and ignores a second submit", async () => {
    const { mutationFn } = setup();
    mutationFn.mockReturnValue(new Promise(() => undefined));
    await userEvent.type(screen.getByLabelText("Reason for the lead"), "Fix X");
    await userEvent.click(submitButton());
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    fireEvent.submit(screen.getByLabelText("Reason for the lead"));
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("links the hint and counter to the field and counts trimmed text", async () => {
    setup();
    const field = screen.getByLabelText("Reason for the lead");
    await userEvent.type(field, "  ab  ");
    expect(field).toHaveAccessibleDescription(
      "The lead sees this note on the returned section. 2 / 2000",
    );
  });

  it("counts a schema-valid non-BMP reason below the unchanged native cap", async () => {
    const user = userEvent.setup();
    const { mutationFn, onRequested } = setup();
    const reason = "😀".repeat(500);
    const command = reviewVerdictInputSchema.parse({
      reportSectionId: SECTION,
      verdict: "changes_requested",
      version: 3,
      comment: reason,
    });
    const result = {
      verdict: "changes_requested",
      judgedVersion: 3,
      unsubmitted: true,
    };
    mutationFn.mockResolvedValue(result);
    const field = screen.getByLabelText("Reason for the lead");
    expect(field).toHaveAttribute("maxlength", "2000");
    await user.click(field);
    await user.paste(reason);
    expect(field).toHaveValue(reason);
    expect(field).toHaveAccessibleDescription(
      "The lead sees this note on the returned section. 500 / 2000",
    );
    await user.click(submitButton());
    await waitFor(() => {
      expect(onRequested).toHaveBeenCalledExactlyOnceWith(result);
    });
    expect(mutationFn).toHaveBeenCalledExactlyOnceWith(
      command,
      expect.anything(),
    );
  });
});
