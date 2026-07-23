import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideSkeleton } from "./slide-skeleton";

describe("SlideSkeleton — root container ARIA attributes", () => {
  it("root div has role='status'", () => {
    render(<SlideSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("root div has aria-busy='true'", () => {
    render(<SlideSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("root div has aria-label='Loading slides'", () => {
    render(<SlideSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading slides",
    );
  });
});

describe("SlideSkeleton — skeleton-list", () => {
  it("renders exactly 4 skeleton divs in the sidebar list container", () => {
    const { container } = render(<SlideSkeleton />);

    // The sidebar list container has class "hidden space-y-2 lg:block".
    // Each child is an animate-pulse skeleton div with class h-24.
    const listContainer = container.querySelector(".hidden.space-y-2");
    expect(listContainer).not.toBeNull();
    const skeletonItems =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
      listContainer!.querySelectorAll(".h-24.animate-pulse");
    expect(skeletonItems).toHaveLength(4);
  });
});
