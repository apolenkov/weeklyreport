import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ReportHealthPulse } from "../model/report-health-pulse";
import type { StatusOverviewModel } from "../model/status-overview";
import { healthLocations } from "./report-health-pulse";
import { StatusOverview } from "./status-overview";

function overviewItem(index: number) {
  return {
    key: `current:item-${String(index)}`,
    recordId: `item-${String(index)}`,
    source: "current" as const,
    editTarget: {
      recordId: `item-${String(index)}`,
      source: "current" as const,
    },
    stableId: `item-${String(index)}`,
    text: `Work item ${String(index)}`,
    tag: "delivery",
    stageNames: [],
    pausedReason: null,
    canResolve: true,
    canRestore: false,
    workflowStatus: "in_progress" as const,
    needsConfirmation: false,
    continuity: index === 1 ? ("unplanned" as const) : ("continued" as const),
  };
}

const model: StatusOverviewModel = {
  periods: {
    previouslyPlanned: "24–30 Aug 2026",
    currentWeek: "31 Aug–6 Sep 2026",
    nextWeek: "7–13 Sep 2026",
  },
  previousPlanSource: "published",
  sourceCounts: { previouslyPlanned: 0, currentWeek: 5, nextWeek: 0 },
  units: [
    {
      key: "activity:activity-1",
      id: "activity-1",
      kind: "activity",
      name: "Incident duty",
      historical: false,
      status: "blocked",
      stages: [],
      linkedProducts: ["Payments", "Mobile"],
      columns: {
        previouslyPlanned: { availability: "available", items: [] },
        currentWeek: {
          availability: "available",
          items: [1, 2, 3, 4, 5].map(overviewItem),
        },
        nextWeek: { availability: "available", items: [] },
      },
    },
  ],
};

describe("StatusOverview", () => {
  it("marks only unplanned Current items", () => {
    render(<StatusOverview model={model} />);
    expect(screen.getAllByText("Unplanned")).toHaveLength(1);
    const preview = screen
      .getByText("Work item 1")
      .closest<HTMLElement>("[data-overview-item-preview]");
    if (!preview) throw new Error("Expected the item preview");
    expect(within(preview).getByText("Unplanned")).toBeTruthy();
  });

  it("uses one clear item grammar without linked-step or drag controls", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const onMoveItem = vi.fn();
    render(
      <StatusOverview
        model={model}
        onEditItem={onEditItem}
        onMoveItem={onMoveItem}
      />,
    );

    expect(screen.queryByText(/next step/i)).toBeNull();
    expect(screen.queryByText(/drag/i)).toBeNull();
    expect(screen.queryByRole("group", { name: "Displayed week" })).toBeNull();
    expect(screen.getAllByText("Current week").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Next week").length).toBeGreaterThan(1);

    const preview = screen
      .getByText("Work item 1")
      .closest<HTMLElement>("[data-overview-item-preview]");
    if (!preview) throw new Error("Expected the item preview");
    await user.click(within(preview).getByText("More actions"));
    await user.click(
      within(preview).getByRole("button", {
        name: "Move to next week: Work item 1",
      }),
    );
    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: "item-1" }),
      "next",
      "move:current:item-1",
    );
  });

  it("routes carried Current work through the same canonical progress editor", async () => {
    const user = userEvent.setup();
    const onConfirmItem = vi.fn();
    const onResolvePlan = vi.fn();
    const onEditItem = vi.fn();
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const carried = { ...overviewItem(1), needsConfirmation: true };
    render(
      <StatusOverview
        model={{
          ...model,
          units: [
            {
              ...unit,
              columns: {
                ...unit.columns,
                currentWeek: { availability: "available", items: [carried] },
              },
            },
          ],
        }}
        onConfirmItem={onConfirmItem}
        onResolvePlan={onResolvePlan}
        onEditItem={onEditItem}
        onMoveItem={vi.fn()}
      />,
    );

    // The carried primary keeps the confirm anchor so the submit-readiness
    // deep link still resolves, but it opens the canonical editor like every
    // other Update progress control.
    const progress = screen.getByRole("button", {
      name: "Update progress for Work item 1",
    });
    expect(progress).toHaveAttribute("id", "confirm:current:item-1");
    expect(progress).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:item-1",
    );
    expect(
      screen.queryByRole("button", {
        name: "Confirm Work item 1 for this week",
      }),
    ).toBeNull();
    await user.click(progress);
    expect(onEditItem).toHaveBeenCalledWith({
      recordId: "item-1",
      source: "current",
    });
    expect(onConfirmItem).not.toHaveBeenCalled();
    expect(onResolvePlan).not.toHaveBeenCalled();

    const preview = screen
      .getByText("Work item 1")
      .closest<HTMLElement>("[data-overview-item-preview]");
    if (!preview) throw new Error("Expected the item preview");
    await user.click(within(preview).getByText("More actions"));
    expect(
      within(preview).getByRole("button", {
        name: "Edit details: Work item 1",
      }),
    ).toBeVisible();
    expect(
      within(preview).getByRole("button", {
        name: "Move to next week: Work item 1",
      }),
    ).toBeVisible();
    // The unconfirmed carry offers no terminal outcome entry: Update progress
    // through the canonical editor is the only way to clear it.
    expect(
      within(preview).queryByRole("button", {
        name: "Update status: Work item 1",
      }),
    ).toBeNull();
  });

  it("keeps the terminal Update status entry inside More actions", async () => {
    const user = userEvent.setup();
    const onResolvePlan = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverview
        model={model}
        onResolvePlan={onResolvePlan}
        onEditItem={onEditItem}
      />,
    );

    const preview = screen
      .getByText("Work item 1")
      .closest<HTMLElement>("[data-overview-item-preview]");
    if (!preview) throw new Error("Expected the item preview");
    // Exactly one primary; the outcome path stays inside the quiet overflow.
    expect(
      within(preview).getByRole("button", {
        name: "Update progress for Work item 1",
      }),
    ).toBeInTheDocument();

    await user.click(within(preview).getByText("More actions"));
    const updateStatus = within(preview).getByRole("button", {
      name: "Update status: Work item 1",
    });
    // The entry is confined to the disclosure — never a standalone control.
    expect(updateStatus.closest("details")).toContainElement(
      within(preview).getByText("More actions"),
    );
    await user.click(updateStatus);

    expect(onResolvePlan).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: "item-1" }),
      "resolve:current:item-1",
    );
    expect(onEditItem).not.toHaveBeenCalled();
  });

  it("keeps a locked cancelled carry informational without mutation controls", () => {
    const onConfirmItem = vi.fn();
    const onResolvePlan = vi.fn();
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const cancelledCarry = {
      ...overviewItem(1),
      editTarget: null,
      canResolve: false,
      needsConfirmation: true,
      resolution: {
        kind: "wont_do" as const,
        eventId: "event-confirm-carry",
        reason: "No longer needed",
        actorId: "lead-1",
        actorName: "Lead",
        occurredAt: "2026-09-01T09:00:00.000Z",
        previousState: {
          type: "current" as const,
          workflowStatus: "in_progress" as const,
          pausedReason: null,
          nextStepText: null,
          text: "Work item 1",
        },
      },
    };
    render(
      <StatusOverview
        model={{
          ...model,
          units: [
            {
              ...baseUnit,
              columns: {
                ...baseUnit.columns,
                currentWeek: {
                  availability: "available",
                  items: [cancelledCarry],
                },
              },
            },
          ],
        }}
        onConfirmItem={onConfirmItem}
        onResolvePlan={onResolvePlan}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    expect(screen.getByText(/Won't do · No longer needed/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Confirm .* for this week/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
    expect(screen.queryByText("More actions")).toBeNull();
    expect(onConfirmItem).not.toHaveBeenCalled();
    expect(onResolvePlan).not.toHaveBeenCalled();
  });

  it("keeps blocked and missing locations visible and names an empty activity", () => {
    const base: ReportHealthPulse["units"][number] = {
      key: "product:payments",
      name: "Payments",
      kind: "product",
      status: "blocked",
      historical: false,
      stages: [
        { name: "Delivery", status: "blocked" },
        { name: "Design", status: "empty" },
      ],
      missingStages: ["Design"],
      risks: [],
    };

    expect(healthLocations(base)).toBe("Delivery · Not reported: Design");
    expect(
      healthLocations({
        ...base,
        kind: "activity",
        status: "empty",
        stages: [],
        missingStages: [],
      }),
    ).toBe("Status not reported");
  });

  it("shows complete product health detail and honest healthy or empty summaries", async () => {
    const user = userEvent.setup();
    const sourceUnit = model.units[0];
    if (!sourceUnit) throw new Error("Expected the overview unit fixture");
    const description =
      "A deliberately long dependency description that must remain visible in inspection";
    const impact =
      "A deliberately long impact explanation that must remain visible in inspection";
    const mitigation =
      "A deliberately long mitigation plan that must remain visible in inspection";
    const stages = [
      { name: "Discovery", status: "on-track" as const },
      { name: "Analysis", status: "on-track" as const },
      { name: "Design", status: "empty" as const },
      { name: "Development", status: "blocked" as const },
      { name: "Testing", status: "on-track" as const },
      { name: "Release", status: "on-track" as const },
      { name: "Support", status: "on-track" as const },
    ];
    const productModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...sourceUnit,
          key: "product:payments",
          id: "payments",
          kind: "product",
          name: "Payments platform with a deliberately long reporting name",
          linkedProducts: [],
          stages,
        },
      ],
    };
    const healthUnit: ReportHealthPulse["units"][number] = {
      key: "product:payments",
      name: "Payments platform with a deliberately long reporting name",
      kind: "product",
      status: "blocked",
      historical: false,
      stages,
      missingStages: ["Design"],
      risks: [
        {
          id: "long-risk",
          description,
          impact,
          mitigation,
          severity: "blocked",
          locations: ["Development"],
        },
      ],
    };
    const rendered = render(
      <StatusOverview
        model={productModel}
        health={{
          units: [healthUnit],
          blocked: 1,
          atRisk: 0,
          missing: 1,
          total: 1,
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Inspect health for Payments platform with a deliberately long reporting name",
      }),
    );
    const detail = screen.getByRole("region", {
      name: "Health details for Payments platform with a deliberately long reporting name",
    });
    const stageList = within(detail).getByRole("list", {
      name: "All stages for Payments platform with a deliberately long reporting name",
    });
    for (const stage of stages) {
      expect(within(stageList).getByText(stage.name)).toBeVisible();
    }
    expect(within(detail).getByText(description)).toBeVisible();
    expect(within(detail).getByText(impact)).toBeVisible();
    expect(within(detail).getByText(mitigation)).toBeVisible();
    rendered.unmount();

    const healthy = render(
      <StatusOverview
        model={productModel}
        health={{
          units: [
            {
              ...healthUnit,
              status: "on-track",
              stages: stages.map((stage) => ({
                ...stage,
                status: "on-track" as const,
              })),
              missingStages: [],
              risks: [],
            },
          ],
          blocked: 0,
          atRisk: 0,
          missing: 0,
          total: 1,
        }}
      />,
    );
    expect(
      screen.getByText("No blocked, at-risk or missing statuses reported."),
    ).toBeVisible();
    healthy.unmount();

    render(
      <StatusOverview
        model={{ ...productModel, units: [] }}
        health={{ units: [], blocked: 0, atRisk: 0, missing: 0, total: 0 }}
      />,
    );
    expect(screen.getByText("No current reporting units.")).toBeVisible();
    expect(screen.queryByText("On track")).toBeNull();
  });

  it("inspects health from pulse and unit name without writes or losing pending input, and returns focus", async () => {
    const user = userEvent.setup();
    const mutation = vi.fn();
    const health: ReportHealthPulse = {
      total: 1,
      blocked: 1,
      atRisk: 0,
      missing: 0,
      units: [
        {
          key: "activity:activity-1",
          name: "Incident duty",
          kind: "activity",
          status: "blocked",
          historical: false,
          stages: [],
          missingStages: [],
          risks: [
            {
              id: "risk",
              description: "Dependency unavailable",
              impact: "Release delayed",
              mitigation: "Use backup service",
              severity: "blocked",
              locations: [],
            },
          ],
        },
      ],
    };
    render(
      <StatusOverview
        model={model}
        health={health}
        onAddItem={mutation}
        onEditItem={mutation}
        onResolvePlan={mutation}
        onRestorePlan={mutation}
        editorSlot={{
          mode: "create",
          unitKey: "activity:activity-1",
          recordId: null,
          source: "current",
          content: (
            <input
              aria-label="Pending update"
              defaultValue="Keep my unfinished work"
            />
          ),
        }}
      />,
    );
    const pulseOpener = screen.getByRole("button", {
      name: "Inspect health for Incident duty",
    });
    await user.click(pulseOpener);
    const detail = screen.getByRole("region", {
      name: "Health details for Incident duty",
    });
    expect(detail).toHaveFocus();
    expect(within(detail).getByText("Dependency unavailable")).toBeVisible();
    expect(within(detail).getByText("Release delayed")).toBeVisible();
    expect(within(detail).getByText("Use backup service")).toBeVisible();
    expect(within(detail).queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Pending update" })).toHaveValue(
      "Keep my unfinished work",
    );
    await user.click(
      within(detail).getByRole("button", { name: "Close health details" }),
    );
    expect(pulseOpener).toHaveFocus();
    const nameOpener = screen.getByRole("button", {
      name: "Incident duty",
    });
    await user.click(nameOpener);
    expect(
      screen.getByRole("region", { name: "Health details for Incident duty" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(nameOpener).toHaveFocus();
    expect(
      screen.queryByRole("region", {
        name: "Health details for Incident duty",
      }),
    ).toBeNull();
    expect(screen.getByRole("textbox", { name: "Pending update" })).toHaveValue(
      "Keep my unfinished work",
    );
    expect(mutation).not.toHaveBeenCalled();
  });

  it("renders an explicit empty state when the period has no reporting units", () => {
    render(<StatusOverview model={{ ...model, units: [] }} />);

    expect(
      screen.getByText("No reporting units are available for this period."),
    ).toBeVisible();
  });

  it("shows two previews and expands the remaining items inline accessibly", async () => {
    const user = userEvent.setup();
    render(<StatusOverview model={model} />);

    const disclosure = screen.getByRole("button", { name: "+3 more" });
    const thirdItem = screen.getByText("Work item 3");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveAttribute("aria-controls");
    expect(screen.getByText("Work item 1")).toBeVisible();
    expect(screen.getByText("Work item 2")).toBeVisible();
    expect(thirdItem).not.toBeVisible();
    expect(thirdItem.closest("li[hidden]")).toHaveAttribute("inert");
    expect(screen.getByText("+3 more")).toBeVisible();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(thirdItem).toBeVisible();
    expect(screen.queryByText("+3 more")).not.toBeInTheDocument();
  });

  it("uses a flat editable row and emits the explicit current-item target", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(<StatusOverview model={model} onEditItem={onEditItem} />);

    const text = screen.getByText("Work item 1");
    const preview = text.closest<HTMLElement>("[data-overview-item-preview]");
    if (!preview) throw new Error("Expected the item preview");
    await user.click(within(preview).getByText("More actions"));
    const edit = within(preview).getByRole("button", {
      name: "Edit details: Work item 1",
    });
    expect(edit.closest("li")).not.toHaveClass("rounded-[var(--radius-sm)]");
    expect(edit).toHaveAccessibleName("Edit details: Work item 1");
    expect(edit).toHaveTextContent("Edit details");
    expect(edit).toHaveAttribute("data-overview-focus", "edit:current:item-1");
    expect(text.tagName).toBe("BUTTON");
    expect(text).toHaveAccessibleName("Edit item: Work item 1");

    await user.click(text);
    expect(onEditItem).toHaveBeenCalledWith({
      recordId: "item-1",
      source: "current",
    });
    onEditItem.mockClear();

    await user.click(edit);

    expect(onEditItem).toHaveBeenCalledWith({
      recordId: "item-1",
      source: "current",
    });
  });

  it("keeps the three-week lineage visible above the exact linked editor", () => {
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const item = (
      source: "previous" | "current" | "next",
      stableId: string,
      text: string,
    ) => ({
      ...overviewItem(stableId === "shared" ? 1 : 2),
      key: `${source}:${stableId}`,
      recordId: `${source}-${stableId}`,
      stableId,
      source,
      editTarget:
        source === "previous"
          ? null
          : { recordId: `${source}-${stableId}`, source },
      text,
    });
    const linkedModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...unit,
          columns: {
            previouslyPlanned: {
              availability: "available",
              items: [
                item("previous", "shared", "Previous shared"),
                item("previous", "other", "Previous other"),
              ],
            },
            currentWeek: {
              availability: "available",
              items: [
                item("current", "shared", "Current shared"),
                item("current", "other", "Current other"),
              ],
            },
            nextWeek: {
              availability: "available",
              items: [
                item("next", "shared", "Next shared"),
                item("next", "other", "Next other"),
              ],
            },
          },
        },
      ],
    };

    const rendered = render(
      <StatusOverview
        model={linkedModel}
        editorSlot={{
          mode: "resolve",
          unitKey: unit.key,
          source: "current",
          recordId: "a-different-record-id",
          stableId: "shared",
          content: <form aria-label="Resolve plan editor" />,
        }}
      />,
    );

    const editor = screen.getByRole("form", { name: "Resolve plan editor" });
    expect(editor.parentElement).toHaveClass("md:col-span-3");
    const previousLane = screen
      .getByText("Previous shared")
      .closest("[data-overview-lineage-lane]");
    const currentSharedLane = screen
      .getByText("Current shared")
      .closest("[data-overview-lineage-lane]");
    const nextLane = screen
      .getByText("Next shared")
      .closest("[data-overview-lineage-lane]");
    for (const lane of [previousLane, currentSharedLane, nextLane]) {
      expect(lane).not.toHaveClass("hidden");
      expect(lane).toHaveClass("md:flex");
    }
    // The matched cell keeps its preview; the editor is a separate full-width
    // cell appended after the three lineage cells of the same row.
    expect(
      currentSharedLane?.querySelector("[data-overview-item-preview]"),
    ).not.toBeNull();
    const matchedRow = currentSharedLane?.parentElement ?? null;
    expect(matchedRow?.lastElementChild).toContainElement(editor);
    expect(
      screen.getByText("Current other").closest("[data-overview-lineage-lane]"),
    ).not.toHaveClass("md:col-span-3");
    const otherRow =
      screen.getByText("Current other").closest("[data-overview-lineage-lane]")
        ?.parentElement ?? null;
    expect(otherRow).not.toContainElement(editor);
    expect(screen.getAllByRole("form")).toHaveLength(1);

    rendered.rerender(<StatusOverview model={linkedModel} />);
    expect(
      screen
        .getByText("Previous shared")
        .closest("[data-overview-lineage-lane]"),
    ).toHaveClass("block");
    expect(
      screen
        .getByText("Current shared")
        .closest("[data-overview-lineage-lane]"),
    ).toHaveClass("block");
    expect(
      screen.getByText("Next shared").closest("[data-overview-lineage-lane]"),
    ).toHaveClass("block");
    const currentHeader = document.getElementById(
      "status-overview-current-week-heading",
    );
    const currentLane = screen
      .getByText("Current shared")
      .closest("[data-overview-lineage-lane]");
    expect(currentHeader).toHaveAttribute("id");
    expect(currentLane).toHaveAttribute("aria-labelledby", currentHeader?.id);
    expect(
      screen.getByText("Current shared").closest("[data-overview-item-slot]"),
    ).toHaveClass("md:h-full", "md:flex-1");
    expect(screen.queryByText(/Drag this/i)).not.toBeInTheDocument();
  });

  it("names a noneditable empty temporal cell instead of leaving only a dash", () => {
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const current = overviewItem(1);
    const readOnlyModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...unit,
          columns: {
            previouslyPlanned: {
              availability: "available",
              items: [
                {
                  ...current,
                  key: "previous:item-1",
                  source: "previous",
                  editTarget: null,
                },
              ],
            },
            currentWeek: { availability: "available", items: [current] },
            nextWeek: { availability: "available", items: [] },
          },
        },
      ],
    };

    render(<StatusOverview model={readOnlyModel} />);

    // R55: the empty lane is a quiet dash on desktop (sr-only name stays);
    // on mobile it folds into the row's single collapse line instead of a
    // labelled "No item" strip.
    const emptyLane = document.querySelector(
      '[data-overview-lineage-lane="next"]',
    );
    expect(emptyLane).toHaveClass("hidden", "md:flex");
    expect(emptyLane).toHaveTextContent("No item in this period");
    expect(emptyLane).not.toHaveTextContent("7–13 Sep 2026");
    expect(screen.getByText("No item in Next week")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add next step" })).toBeNull();
  });

  it("keeps all labelled week sections visible on mobile without next-step controls", () => {
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const current = overviewItem(1);
    const linkedModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...unit,
          columns: {
            previouslyPlanned: {
              availability: "available",
              items: [
                {
                  ...current,
                  key: "previous:item-1",
                  source: "previous",
                  editTarget: null,
                },
              ],
            },
            currentWeek: { availability: "available", items: [current] },
            nextWeek: { availability: "available", items: [] },
          },
        },
      ],
    };

    render(<StatusOverview model={linkedModel} />);

    // R15: every week label stays visible once in the shared mobile periods
    // header; populated cells still repeat their own lane label.
    for (const label of ["Previously planned", "Current week", "Next week"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText("Current week").length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Add next step" })).toBeNull();
  });

  it("keeps equal record IDs isolated to the editor slot unit", () => {
    const first = model.units[0];
    if (!first) throw new Error("Expected one overview unit");
    const sharedRecordItem = (text: string) => ({
      ...overviewItem(1),
      key: `current:${text}`,
      stableId: null,
      text,
    });
    const second = {
      ...first,
      key: "activity:activity-2",
      id: "activity-2",
      name: "Release duty",
      columns: {
        ...first.columns,
        currentWeek: {
          availability: "available" as const,
          items: [sharedRecordItem("Second unit update")],
        },
      },
    };
    const scopedModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...first,
          columns: {
            ...first.columns,
            currentWeek: {
              availability: "available",
              items: [sharedRecordItem("First unit update")],
            },
          },
        },
        second,
      ],
    };

    render(
      <StatusOverview
        model={scopedModel}
        editorSlot={{
          mode: "edit",
          unitKey: first.key,
          source: "current",
          recordId: "item-1",
          stableId: null,
          content: <form aria-label="First unit editor" />,
        }}
      />,
    );

    expect(screen.getAllByRole("form")).toHaveLength(1);
    expect(
      within(
        screen.getByRole("article", { name: "Activity Release duty" }),
      ).getByText("Second unit update"),
    ).toBeInTheDocument();
  });

  it("keeps independent Current and Next items on separate rows", () => {
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const next = {
      ...overviewItem(8),
      key: "next:independent",
      recordId: "item-1",
      stableId: "next-independent",
      source: "next" as const,
      editTarget: { recordId: "item-1", source: "next" as const },
      text: "Independent next update",
    };
    const independentModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...unit,
          columns: {
            ...unit.columns,
            nextWeek: { availability: "available", items: [next] },
          },
        },
      ],
    };
    render(<StatusOverview model={independentModel} />);

    expect(screen.getByText("Work item 1")).toBeInTheDocument();
    expect(screen.getAllByText("Work item 1")).toHaveLength(1);
    expect(screen.getAllByText("Independent next update")).toHaveLength(1);
    expect(screen.getByText("Work item 1").closest("li")).not.toBe(
      screen.getByText("Independent next update").closest("li"),
    );
  });

  it("uses one Add item entry point and keeps its editor in the unit footer", () => {
    const unit = model.units[0];
    if (!unit) throw new Error("Expected one overview unit");
    const onAddItem = vi.fn();
    const rendered = render(
      <StatusOverview
        model={model}
        onAddItem={onAddItem}
        editorSlot={{
          mode: "create",
          unitKey: unit.key,
          source: "next",
          recordId: null,
          stableId: null,
          content: <form aria-label="Create next update" />,
        }}
      />,
    );
    const footer = screen.getByTestId("report-unit-footer");
    expect(
      within(footer).getByRole("form", { name: "Create next update" }),
    ).toBeVisible();
    expect(screen.getAllByRole("form")).toHaveLength(1);

    rendered.rerender(<StatusOverview model={model} onAddItem={onAddItem} />);
    expect(
      screen.getByRole("button", { name: "Add item to Incident duty" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add item to/ })).toHaveLength(
      1,
    );
  });

  it("opens the canonical editor from the single Update progress action", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const onResolvePlan = vi.fn();
    render(
      <StatusOverview
        model={model}
        onEditItem={onEditItem}
        onResolvePlan={onResolvePlan}
      />,
    );

    const progress = screen.getByRole("button", {
      name: "Update progress for Work item 1",
    });
    expect(progress).toHaveAttribute(
      "data-overview-focus",
      "edit:current:item-1",
    );

    await user.click(progress);

    expect(onEditItem).toHaveBeenCalledWith({
      recordId: "item-1",
      source: "current",
    });
    expect(onResolvePlan).not.toHaveBeenCalled();
  });

  it("shows cancelled plans as non-editable, with reason, audit, and restore callback", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const onRestorePlan = vi.fn();
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const cancelled = {
      ...overviewItem(1),
      editTarget: null,
      canResolve: false,
      canRestore: true,
      resolution: {
        kind: "wont_do" as const,
        eventId: "event-1",
        reason: "The dependency closed.",
        actorId: "lead-1",
        actorName: "Lead",
        occurredAt: "2026-09-05T12:00:00.000Z",
        previousState: {
          type: "current" as const,
          workflowStatus: "in_progress" as const,
          pausedReason: null,
          nextStepText: null,
          text: "Cancelled delivery",
        },
      },
      outcomeHistory: [
        {
          id: "event-1",
          stableId: "item-1",
          outcome: "wont_do" as const,
          reason: "The dependency closed.",
          actorId: "lead-1",
          actorName: "Lead",
          occurredAt: "2026-09-05T12:00:00.000Z",
          beforeState: {
            type: "current" as const,
            workflowStatus: "in_progress" as const,
            pausedReason: null,
            nextStepText: null,
            text: "Delivered the API",
          },
          afterState: {
            type: "current" as const,
            workflowStatus: "done" as const,
            pausedReason: null,
            nextStepText: null,
            text: "Promoted next step",
          },
          reversesEventId: null,
        },
      ],
    };
    render(
      <StatusOverview
        model={{
          ...model,
          units: [
            {
              ...baseUnit,
              columns: {
                ...baseUnit.columns,
                currentWeek: { availability: "available", items: [cancelled] },
              },
            },
          ],
        }}
        onEditItem={onEditItem}
        onRestorePlan={onRestorePlan}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Edit update: Work item 1/ }),
    ).toBeNull();
    expect(screen.queryByText("In progress")).toBeNull();
    expect(screen.getByText(/Won't do · The dependency closed/)).toBeVisible();
    const restore = screen.getByRole("button", {
      name: "Restore Work item 1",
    });
    expect(restore).toHaveAttribute(
      "data-overview-focus",
      "restore:current:item-1",
    );

    await user.click(restore);
    expect(onRestorePlan).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Work item 1" }),
      "restore:current:item-1",
    );

    const audit = screen.getByText("History").closest("details");
    if (!audit) throw new Error("Expected outcome audit disclosure");
    await user.click(screen.getByText("History"));
    expect(audit).toHaveTextContent("Marked Won't do by Lead");
    expect(audit).toHaveTextContent("2026-09-05 12:00 UTC");
    expect(audit).toHaveTextContent("Previous: Delivered the API");
  });

  it("expands the whole unit so temporal lanes cannot lose row alignment", async () => {
    const user = userEvent.setup();
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const independentModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...baseUnit,
          columns: {
            ...baseUnit.columns,
            nextWeek: {
              availability: "available",
              items: [1, 2, 3].map((index) => ({
                ...overviewItem(index),
                key: `next:item-${String(index)}`,
                recordId: `next-item-${String(index)}`,
                stableId: `next-lineage-${String(index)}`,
                source: "next" as const,
                editTarget: {
                  recordId: `next-item-${String(index)}`,
                  source: "next" as const,
                },
                text: `Next item ${String(index)}`,
              })),
            },
          },
        },
      ],
    };
    render(<StatusOverview model={independentModel} />);

    const nextThird = screen.getByText("Next item 3");
    expect(nextThird).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "+6 more" }));

    expect(screen.getByText("Work item 3")).toBeVisible();
    expect(nextThird).toBeVisible();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("allows reading full previous text without offering a write action", () => {
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const inertModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...baseUnit,
          columns: {
            ...baseUnit.columns,
            previouslyPlanned: {
              availability: "available",
              items: [
                {
                  ...overviewItem(8),
                  key: "previous:item-8",
                  source: "previous",
                  editTarget: null,
                  text: "Immutable prior plan",
                },
              ],
            },
            currentWeek: {
              availability: "available",
              items: [
                {
                  ...overviewItem(9),
                  editTarget: null,
                  text: "Submitted current item",
                },
              ],
            },
          },
        },
      ],
    };
    render(<StatusOverview model={inertModel} onEditItem={vi.fn()} />);

    expect(screen.getByText("Immutable prior plan")).toBeInTheDocument();
    expect(screen.getByText("Submitted current item")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Edit Immutable prior plan/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Edit Submitted current item/i }),
    ).toBeNull();
  });

  it('renders canonical status and all three real period ranges without a "Not in prior plan" label', () => {
    render(<StatusOverview model={model} />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Products: Payments, Mobile")).toBeInTheDocument();
    expect(screen.getAllByText("24–30 Aug 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31 Aug–6 Sep 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7–13 Sep 2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("Not in prior plan")).toBeNull();
  });

  it.each(["empty", "on-track"] as const)(
    "suppresses the non-actionable %s health badge",
    (status) => {
      const unit = model.units[0];
      if (!unit) throw new Error("Expected one overview unit");
      render(
        <StatusOverview model={{ ...model, units: [{ ...unit, status }] }} />,
      );

      expect(screen.queryByText("No status")).toBeNull();
      expect(screen.queryByText("On track")).toBeNull();
      expect(screen.getByText("Incident duty")).toBeVisible();
    },
  );

  it("keeps progress and continuity readable outside the edit action", () => {
    render(<StatusOverview model={model} onEditItem={vi.fn()} />);

    const progress = screen.getByRole("button", {
      name: "Update progress for Work item 1",
    });
    expect(progress).toHaveAccessibleName("Update progress for Work item 1");
    expect(progress).toHaveTextContent("Update progress");
    expect(progress).toHaveAttribute(
      "data-overview-focus",
      "edit:current:item-1",
    );
    expect(progress.closest("[data-overview-item-preview]")).toHaveTextContent(
      "In progress",
    );
    expect(
      progress.closest("[data-overview-item-preview]"),
    ).not.toHaveTextContent("Not in prior plan");
    const row = progress.closest("article")?.firstElementChild;
    expect(row).toHaveClass("min-[80rem]:grid-cols-[repeat(4,minmax(0,1fr))]");
  });

  it("offers one full-report edit action instead of repeating it per row", () => {
    render(<StatusOverview model={model} detailsHref="/report?mode=edit" />);

    expect(
      screen.getAllByRole("link", { name: "Risks & decisions" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Risks & decisions" }),
    ).toHaveAttribute("href", "/report?mode=edit");
  });

  it("groups products and activities, keeps long names readable, and exposes one Add target per unit", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    const activity = model.units[0];
    if (!activity) throw new Error("Expected one overview unit");
    const longProductName = "Marketing platform with a deliberately long name";
    const product = {
      ...activity,
      key: "product:product-1",
      id: "product-1",
      kind: "product" as const,
      name: longProductName,
      linkedProducts: [],
      columns: {
        ...activity.columns,
        currentWeek: { availability: "available" as const, items: [] },
        nextWeek: { availability: "available" as const, items: [] },
      },
    };

    render(
      <StatusOverview
        model={{ ...model, units: [product, activity] }}
        onAddItem={onAddItem}
      />,
    );

    const products = screen.getByRole("region", { name: "Products" });
    const activities = screen.getByRole("region", {
      name: "Project activities",
    });
    expect(within(products).getByText("1")).toBeVisible();
    expect(within(activities).getByText("1")).toBeVisible();

    const longName = screen.getByText(longProductName);
    expect(longName).not.toHaveClass("truncate");
    expect(longName).toHaveClass("break-words");

    expect(
      screen.getByRole("button", {
        name: `Add item to ${longProductName}`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Add item to Incident duty",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: `Add previously planned week update to ${longProductName}`,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Add item to Incident duty",
      }),
    );
    expect(onAddItem).toHaveBeenCalledWith({
      source: "current",
      unitKind: "activity",
      unitId: "activity-1",
    });
  });

  it("hides quick-add for historical units even when a handler exists", () => {
    const onAddItem = vi.fn();
    const activity = model.units[0];
    if (!activity) throw new Error("Expected one overview unit");
    render(
      <StatusOverview
        model={{
          ...model,
          units: [{ ...activity, historical: true }],
        }}
        onAddItem={onAddItem}
      />,
    );

    expect(screen.getByText("Work item 1")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Add current week update to Incident duty",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Add next week update to Incident duty",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps a historical Activity visible without the weekly fields editor", () => {
    const onActivityFieldsChange = vi.fn();
    const activity = model.units[0];
    if (!activity) throw new Error("Expected one overview unit");
    const fields = {
      titleOverride: null,
      description: null,
      catalogueName: "Incident duty",
    };
    const { rerender } = render(
      <StatusOverview
        model={{ ...model, units: [{ ...activity, activityFields: fields }] }}
        activityFieldsEditable
        onActivityFieldsChange={onActivityFieldsChange}
      />,
    );
    expect(
      screen.getByRole("form", { name: "Weekly fields for Incident duty" }),
    ).toBeInTheDocument();

    rerender(
      <StatusOverview
        model={{
          ...model,
          units: [{ ...activity, historical: true, activityFields: fields }],
        }}
        activityFieldsEditable
        onActivityFieldsChange={onActivityFieldsChange}
      />,
    );
    expect(screen.getByText("Work item 1")).toBeVisible();
    expect(screen.getByText("Historical")).toBeVisible();
    expect(screen.queryByRole("form", { name: /Weekly fields/ })).toBeNull();
    expect(screen.queryByText("Save weekly fields")).toBeNull();
    expect(onActivityFieldsChange).not.toHaveBeenCalled();
  });

  it("does not render quick-add controls when no create handler is provided", () => {
    render(<StatusOverview model={model} />);

    expect(
      screen.queryByRole("button", { name: /Add .* week update/ }),
    ).toBeNull();
  });
});
