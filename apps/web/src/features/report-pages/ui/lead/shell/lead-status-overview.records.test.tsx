import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  type AuthorReportSectionReadModel,
  authorReportSectionReadModelSchema,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import type { LeadFormDraftSaveInput } from "../../../../report-sections/model/lead-form/lead-form-write-port";
import {
  ACTIVITY_ID,
  pollUntil,
  PROJECT_ID,
  REPORT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe.each(["risk", "decision"] as const)("Overview inline %s", (kind) => {
  it("persists explicit cancellation and retries its lost response with the same deletion intent", async () => {
    const original = Promise.withResolvers<AuthorReportSectionReadModel>();
    const cancelled = Promise.withResolvers<AuthorReportSectionReadModel>();
    let attempts = 0;
    const saveDraft = vi.fn(
      (_input: unknown, _current: ReportSectionReadModel) => {
        attempts += 1;
        if (attempts === 1) return original.promise;
        if (attempts === 2)
          return Promise.reject(new Error("Cancellation response lost"));
        return cancelled.promise;
      },
    );
    const user = userEvent.setup();
    render(
      <Wrapper withActivity inputProvider saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await openUnitRecord(user, "Operational duty", kind);
    const form = await screen.findByRole("form", {
      name: `Add ${kind} to Operational duty`,
    });
    const primary = within(form).getByRole("textbox", {
      name: kind === "risk" ? "Risk" : "Decision",
    });
    await user.type(primary, "Cancelled contextual draft");
    fireEvent.submit(form);
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(form).toBeInTheDocument();
    expect(saveDraft).toHaveBeenCalledTimes(1);
    const first = saveDraft.mock.calls[0];
    if (!first) throw new Error("Expected original request");
    const firstRequest = first[0] as LeadFormDraftSaveInput;
    await act(async () => {
      original.resolve(echoRecordRequest(firstRequest, first[1]));
      await original.promise;
    });
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
    const second = saveDraft.mock.calls[1];
    if (!second) throw new Error("Expected cancellation request");
    const secondRequest = second[0] as LeadFormDraftSaveInput;
    const identity = (
      kind === "risk" ? firstRequest.risks : firstRequest.decisions
    )[0]?.stableId;
    expect(secondRequest).toHaveProperty("deletedIncompleteRecords", [
      { kind, stableId: identity },
    ]);
    expect(secondRequest.version).toBe(firstRequest.version + 1);
    expect(primary).toHaveValue("Cancelled contextual draft");
    await waitFor(() =>
      expect(
        within(form).getByRole("button", { name: `Save ${kind}` }),
      ).toBeEnabled(),
    );
    fireEvent.submit(form);
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(3));
    expect(saveDraft.mock.calls[2]?.[0]).toEqual(secondRequest);
    await act(async () => {
      cancelled.resolve(echoRecordRequest(secondRequest, second[1]));
      await cancelled.promise;
    });
    await waitFor(() => expect(form).not.toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(["Payments", "Operational duty"])(
    "saves minimal input beneath %s and confirms only after the server replies",
    async (parent) => {
      const response = Promise.withResolvers<AuthorReportSectionReadModel>();
      const saveDraft = vi.fn(
        (_input: unknown, _current: ReportSectionReadModel) => response.promise,
      );
      const user = userEvent.setup();
      render(
        <Wrapper withActivity inputProvider saveDraft={saveDraft}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );
      await openUnitRecord(user, parent, kind);
      const form = await screen.findByRole("form", {
        name: `Add ${kind} to ${parent}`,
      });
      expect(form.closest("[data-overview-create-lane]")).toBeNull();
      expect(form.closest("article")).toHaveAccessibleName(
        `${parent === "Payments" ? "Product" : "Activity"} ${parent}`,
      );
      const primary = within(form).getByRole("textbox", {
        name: kind === "risk" ? "Risk" : "Decision",
      });
      expect(primary).toHaveFocus();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(saveDraft).not.toHaveBeenCalled();
      await user.type(primary, "Minimum contextual draft");
      const savedBefore = vi.mocked(toast.success).mock.calls.length;
      fireEvent.submit(form);
      await pollUntil(() => expect(saveDraft).toHaveBeenCalledTimes(1));
      expect(primary).toBeDisabled();
      expect(
        within(form).getByRole("button", { name: "Cancel" }),
      ).toBeEnabled();
      expect(vi.mocked(toast.success).mock.calls).toHaveLength(savedBefore);
      const call = saveDraft.mock.calls[0];
      expect(call).toBeDefined();
      if (!call) throw new Error("Expected dispatched draft");
      const request = call[0] as LeadFormDraftSaveInput;
      const rows = kind === "risk" ? request.risks : request.decisions;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.stableId).toEqual(expect.any(String));
      expect(rows[0]).toMatchObject({
        impact: null,
        activityId: parent === "Operational duty" ? ACTIVITY_ID : null,
        stageNames: parent === "Payments" ? ["Development"] : [],
      });
      expect(rows[0]).toHaveProperty(
        kind === "risk" ? "projectId" : "productId",
        parent === "Payments" ? PROJECT_ID : null,
      );
      await act(async () => {
        response.resolve(echoRecordRequest(request, call[1]));
        await response.promise;
      });
      await pollUntil(() => expect(form).not.toBeInTheDocument());
      expect(toast.success).toHaveBeenLastCalledWith(
        "Saved draft — needs details",
      );
      expect(
        within(
          screen.getByRole("article", { name: new RegExp(parent) }),
        ).getByRole("button", { name: "+ Risk or decision" }),
      ).toHaveFocus();
    },
  );
});

function echoRecordRequest(
  request: LeadFormDraftSaveInput,
  section: ReportSectionReadModel,
) {
  return authorReportSectionReadModelSchema.parse({
    ...section,
    version: request.version + 1,
    items: request.items,
    risks: request.risks,
    decisions: request.decisions,
  });
}

async function openUnitRecord(
  user: ReturnType<typeof userEvent.setup>,
  parent: string,
  kind: string,
) {
  const unit = await screen.findByRole("article", { name: new RegExp(parent) });
  await user.click(
    within(unit).getByRole("button", { name: "+ Risk or decision" }),
  );
  if (kind === "decision")
    await user.click(within(unit).getByRole("radio", { name: "Decision" }));
}
