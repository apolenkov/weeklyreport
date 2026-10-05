import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminUserView } from "../../model/admin-types";
import {
  useStageAssignmentData,
  useStageAssignmentMutations,
} from "../../model/use-stage-assignments";
import { StageAssignmentEditor } from "./stage-assignment-editor";

vi.mock("../../model/use-stage-assignments", () => ({
  useStageAssignmentData: vi.fn(),
  useStageAssignmentMutations: vi.fn(),
}));

const ELIGIBLE_LEAD: AdminUserView = {
  id: "u-eligible",
  name: "Petrov Alex",
  lastName: "Petrov",
  firstName: "Alex",
  middleName: null,
  position: null,
  email: "petrov@example.com",
  role: "lead",
  groupId: "g-1",
  department: "Eng",
  isActive: true,
};

const RETAINED_ASSIGNMENT = {
  id: "a-1",
  userId: "u-retained",
  stageId: "design",
  projectId: "product-1",
  stageName: "Design",
  userName: "Smith John Michael",
};

function mockHooks({
  assignments,
  filteredLeads,
  saveMutate = vi.fn(),
  deleteMutate = vi.fn(),
}: {
  readonly assignments: readonly (typeof RETAINED_ASSIGNMENT)[];
  readonly filteredLeads: readonly AdminUserView[];
  readonly saveMutate?: ReturnType<typeof vi.fn>;
  readonly deleteMutate?: ReturnType<typeof vi.fn>;
}) {
  vi.mocked(useStageAssignmentData).mockReturnValue({
    stages: [{ id: "design", name: "Design", sortOrder: 1 }],
    assignments: [...assignments],
    filteredLeads: [...filteredLeads],
    isLoading: false,
    isError: false,
  });
  vi.mocked(useStageAssignmentMutations).mockReturnValue({
    saveMut: { isPending: false, mutate: saveMutate },
    deleteMut: { isPending: false, mutate: deleteMutate },
  } as unknown as ReturnType<typeof useStageAssignmentMutations>);
}

describe("StageAssignmentEditor", () => {
  it("exposes the initial query as a busy status", () => {
    vi.mocked(useStageAssignmentData).mockReturnValue({
      stages: [],
      assignments: [],
      filteredLeads: [],
      isLoading: true,
      isError: false,
    });
    vi.mocked(useStageAssignmentMutations).mockReturnValue({
      saveMut: { isPending: false, mutate: vi.fn() },
      deleteMut: { isPending: false, mutate: vi.fn() },
    } as unknown as ReturnType<typeof useStageAssignmentMutations>);

    render(
      <StageAssignmentEditor
        projectId="product-1"
        projectName="Reference product"
        leads={[]}
      />,
    );

    expect(
      screen.getByRole("status", {
        name: "Loading stage assignments for Reference product",
      }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("uses readable foreground text and keeps stage color decorative", () => {
    vi.mocked(useStageAssignmentData).mockReturnValue({
      stages: [
        { id: "design", name: "Design", sortOrder: 1 },
        { id: "support", name: "Support", sortOrder: 2 },
      ],
      assignments: [],
      filteredLeads: [],
      isLoading: false,
      isError: false,
    });
    vi.mocked(useStageAssignmentMutations).mockReturnValue({
      saveMut: { isPending: false, mutate: vi.fn() },
      deleteMut: { isPending: false, mutate: vi.fn() },
    } as unknown as ReturnType<typeof useStageAssignmentMutations>);

    render(
      <StageAssignmentEditor
        projectId="product-1"
        projectName="Reference product"
        leads={[]}
      />,
    );

    for (const name of ["Design", "Support"]) {
      const label = screen.getByText(name).closest("label");
      expect(label).toHaveClass("text-[var(--color-foreground)]");
      expect(label).not.toHaveAttribute("style");
      expect(label?.querySelector('[aria-hidden="true"]')).toHaveStyle({
        backgroundColor:
          name === "Design"
            ? "var(--color-starbucks-gold)"
            : "var(--color-muted-foreground)",
      });
    }

    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    for (const stageSelect of screen.getAllByRole("combobox")) {
      expect(stageSelect).toHaveAttribute(
        "data-interaction-effect",
        "mutation-required",
      );
    }
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("keeps a non-eligible current assignee visible as a disabled option", () => {
    const saveMutate = vi.fn();
    const deleteMutate = vi.fn();
    const assignment = { ...RETAINED_ASSIGNMENT };
    const filteredLeads = [{ ...ELIGIBLE_LEAD }];
    const leadsBefore = structuredClone(filteredLeads);
    const assignmentBefore = structuredClone(assignment);
    mockHooks({
      assignments: [assignment],
      filteredLeads,
      saveMutate,
      deleteMutate,
    });

    render(
      <StageAssignmentEditor
        projectId="product-1"
        projectName="Reference product"
        leads={[]}
      />,
    );

    const select = screen.getByRole("combobox", {
      name: "Assign Design stage for Reference product",
    });
    expect(select).toHaveValue("u-retained");
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    const retained = within(select).getByRole("option", {
      name: "Smith J.M.",
    });
    expect(retained).toHaveValue("u-retained");
    expect(retained).toBeDisabled();
    expect(saveMutate).not.toHaveBeenCalled();
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(filteredLeads).toEqual(leadsBefore);
    expect(assignment).toEqual(assignmentBefore);
  });

  it("applies an eligible replacement and an explicit clear over a retained assignee", () => {
    const saveMutate = vi.fn();
    const deleteMutate = vi.fn();
    mockHooks({
      assignments: [RETAINED_ASSIGNMENT],
      filteredLeads: [ELIGIBLE_LEAD],
      saveMutate,
      deleteMutate,
    });

    render(
      <StageAssignmentEditor
        projectId="product-1"
        projectName="Reference product"
        leads={[]}
      />,
    );

    const select = screen.getByRole("combobox", {
      name: "Assign Design stage for Reference product",
    });
    fireEvent.change(select, { target: { value: "u-eligible" } });
    expect(saveMutate).toHaveBeenCalledWith({
      userId: "u-eligible",
      stageId: "design",
      projectId: "product-1",
    });
    fireEvent.change(select, { target: { value: "" } });
    expect(deleteMutate).toHaveBeenCalledWith({ id: "a-1" });
  });

  it("adds no extra option when the current assignee is an eligible lead", () => {
    mockHooks({
      assignments: [{ ...RETAINED_ASSIGNMENT, userId: "u-eligible" }],
      filteredLeads: [ELIGIBLE_LEAD],
    });

    render(
      <StageAssignmentEditor
        projectId="product-1"
        projectName="Reference product"
        leads={[]}
      />,
    );

    const select = screen.getByRole("combobox", {
      name: "Assign Design stage for Reference product",
    });
    expect(select).toHaveValue("u-eligible");
    // R20: the empty option is capitalised like its siblings.
    expect(
      within(select).getByRole("option", { name: "Unassigned" }),
    ).toBeInTheDocument();
    const options = within(select).getAllByRole("option");
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).not.toBeDisabled();
    }
  });
});
