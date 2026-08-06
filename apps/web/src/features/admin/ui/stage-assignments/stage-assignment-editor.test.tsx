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
  });
});
