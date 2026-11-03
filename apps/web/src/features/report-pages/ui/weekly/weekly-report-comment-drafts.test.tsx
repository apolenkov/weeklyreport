import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { ActivityStatusStrip } from "../../../report-sections";
import type { AccordionReviewContext } from "../../../review";
import { ReviewedRow } from "../../../review";
import { AccordionSections } from "../product/accordion-sections";
import { report } from "./weekly-report-comment-drafts.test-support";
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: vi.fn(),
}));
vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      comment: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: (input: unknown) => {
            submission.send(input);
            return submission.pending ?? Promise.resolve({});
          },
        }),
      },
      deleteComment: { mutationOptions: (options: object) => options },
    },
  }),
}));
vi.mock("./weekly-report-page-content", () => ({
  AcknowledgeSurface: () => null,
  ReportOverviewBand: () => null,
  ReviewModeVerdictSurface: () => null,
  ReportAccordionBody: ({
    scope,
    review,
    activitySections,
  }: {
    readonly scope: string;
    readonly review: AccordionReviewContext | undefined;
    readonly activitySections: readonly ReportSectionReadModel[];
  }) => (
    <div key={scope}>
      {scope === "lead" ? (
        <ActivityStatusStrip
          sections={activitySections}
          Row={ReviewedRow}
          review={review}
        />
      ) : null}
      <AccordionSections
        key={scope}
        report={report}
        review={review}
        showNeedsAttention={false}
      />
    </div>
  ),
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { shortItemLabel } from "../../../../shared/lib/format/short-label";
import { createDemoSection } from "../../../../test-utils/fixtures";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  commonStart,
  firstComposer,
  props,
  renderReport,
  riskIds,
  submission,
  submitFirstComment,
} from "./weekly-report-comment-drafts.test-support";

describe("Pending comment ownership — 1", () => {
  it.each(["mode", "scope"])(
    "locks the same key after a %s remount and prevents duplicate sends",
    async (remount) => {
      let finish: () => void = () => {
        throw new Error("Missing submission");
      };
      submission.pending = new Promise((resolve) => {
        finish = () => resolve({});
      });
      const { rerender } = renderReport();
      fireEvent.change(firstComposer(), { target: { value: "Comment A" } });
      submitFirstComment();
      await waitFor(() => expect(submission.send).toHaveBeenCalledOnce());
      if (remount === "mode") {
        rerender({ reviewMode: "read" });
        rerender({});
      } else rerender({ scope: "lead" });
      expect(firstComposer()).toHaveValue("Comment A");
      expect(firstComposer()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
      submitFirstComment();
      finish();
      await waitFor(() => expect(firstComposer()).toBeEnabled());
      expect(submission.send).toHaveBeenCalledOnce();
      expect(firstComposer()).toHaveValue("");
      fireEvent.change(firstComposer(), { target: { value: "Comment B" } });
      rerender({});
      expect(firstComposer()).toHaveValue("Comment B");
    },
  );
});
describe("Head record comment drafts — 2", () => {
  it("preserves an Activity draft through disclosure, Read and scope remounts", () => {
    const section = makeReportSectionFixture({
      ...createDemoSection(),
      canReview: true,
      activities: [],
      items: [],
      decisions: [],
      risks: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          risk: "Activity blocker",
          impact: "Delay",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });
    const { rerender } = renderReport();
    const activityProps = { activitySections: [section] };
    rerender(activityProps);
    const disclosure = () =>
      screen.getByRole("button", {
        name: /Activity details unavailable.*details/,
      });
    fireEvent.click(disclosure());
    const composer = screen.getByRole("textbox", { name: /Activity blocker/ });
    fireEvent.change(composer, { target: { value: "Keep Activity draft" } });
    fireEvent.click(disclosure());
    expect(
      screen.queryByRole("textbox", { name: /Activity blocker/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(disclosure());
    expect(
      screen.getByRole("textbox", { name: /Activity blocker/ }),
    ).toHaveValue("Keep Activity draft");
    rerender({ ...activityProps, reviewMode: "read" });
    expect(
      screen.queryByRole("textbox", { name: /Activity blocker/ }),
    ).not.toBeInTheDocument();
    rerender(activityProps);
    expect(
      screen.getByRole("textbox", { name: /Activity blocker/ }),
    ).toHaveValue("Keep Activity draft");
    rerender({ ...activityProps, scope: "lead" });
    fireEvent.click(disclosure());
    expect(
      screen.getByRole("textbox", { name: /Activity blocker/ }),
    ).toHaveValue("Keep Activity draft");
    rerender(activityProps);
    fireEvent.click(disclosure());
    expect(
      screen.getByRole("textbox", { name: /Activity blocker/ }),
    ).toHaveValue("Keep Activity draft");
  });
});
describe("Head record comment drafts — 3", () => {
  it("survives Review → Read → Review and scope remounts without mixing records", () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Keep this draft" } });
    rerender({ reviewMode: "read" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    rerender({ reviewMode: "review" });
    expect(firstComposer()).toHaveValue("Keep this draft");
    rerender({ scope: "lead" });
    expect(firstComposer()).toHaveValue("Keep this draft");
    expect(screen.getAllByRole("textbox")[1]).toHaveValue("");
  });
});
describe("Head record comment drafts — 4", () => {
  it("isolates drafts by report and author and restores the original draft", () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Original report" } });
    rerender({ reportId: "report-2" });
    expect(firstComposer()).toHaveValue("");
    fireEvent.change(firstComposer(), { target: { value: "Second report" } });
    rerender({});
    expect(firstComposer()).toHaveValue("Original report");
    rerender({
      reviewModel: {
        ...props.reviewModel,
        context: {
          currentUserId: "head-2",
          isAdmin: false,
          onMutated: vi.fn(),
        },
      },
    });
    expect(firstComposer()).toHaveValue("");
    rerender({});
    expect(firstComposer()).toHaveValue("Original report");
  });
});
describe("Head record comment drafts — 5", () => {
  it("clears a successfully submitted draft, including after remounting", async () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Send this" } });
    const form = firstComposer().closest("form");
    if (!form) throw new Error("Expected comment form");
    fireEvent.submit(form);
    await waitFor(() => expect(firstComposer()).toHaveValue(""));
    rerender({ reviewMode: "read" });
    rerender({ scope: "lead" });
    expect(firstComposer()).toHaveValue("");
  });
});
describe("Head comment submission and risk names — 6", () => {
  it("submits an Activity risk comment against its original risk anchor", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const section = makeReportSectionFixture({
      ...createDemoSection(),
      canReview: true,
      activities: [],
      items: [],
      decisions: [],
      risks: [
        {
          id,
          activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          risk: "Activity risk",
          severity: "blocked",
          impact: "Delay",
          mitigation: "Escalate",
          stageNames: [],
        },
      ],
    });
    const { rerender } = renderReport();
    rerender({ activitySections: [section] });
    fireEvent.click(
      screen.getByRole("button", {
        name: /Activity details unavailable.*details/,
      }),
    );
    const composer = screen.getByRole("textbox", { name: /Activity risk/ });
    fireEvent.change(composer, { target: { value: "Check the mitigation" } });
    const form = composer.closest("form");
    if (!form) throw new Error("Expected Activity comment form");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(submission.send).toHaveBeenCalledExactlyOnceWith({
        riskId: id,
        text: "Check the mitigation",
      }),
    );
  });
});
describe("Head comment submission and risk names — 7", () => {
  it("clears only the submitted report when success arrives after navigation", async () => {
    let finish: () => void = () => {
      throw new Error("Missing submission");
    };
    submission.pending = new Promise((resolve) => {
      finish = () => resolve({});
    });
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Send original" } });
    const form = firstComposer().closest("form");
    if (!form) throw new Error("Expected comment form");
    fireEvent.submit(form);
    rerender({ reportId: "report-2" });
    fireEvent.change(firstComposer(), { target: { value: "Keep second" } });
    finish();
    await waitFor(() => expect(firstComposer()).toHaveValue("Keep second"));
    rerender({});
    await waitFor(() => expect(firstComposer()).toHaveValue(""));
    submission.pending = null;
  });
});
describe("Head comment submission and risk names — 8", () => {
  it("names two risk composers distinctly even when short excerpts match", () => {
    renderReport();
    const excerpt = shortItemLabel(commonStart);
    for (const id of riskIds) {
      expect(
        screen.getByRole("textbox", {
          name: `Add a review comment on ${excerpt} (risk ${id})`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: `Comment on ${excerpt} (risk ${id})`,
        }),
      ).toBeInTheDocument();
    }
  });
});
