import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useStageAssignmentData,
  useStageAssignmentMutations,
} from "../../model/use-stage-assignments";
import { StageAssignmentEditor } from "./stage-assignment-editor";

vi.mock("../../model/use-stage-assignments", () => ({
  useStageAssignmentData: vi.fn(),
  useStageAssignmentMutations: vi.fn(),
}));

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
});
