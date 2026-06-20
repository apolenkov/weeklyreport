import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { firstOverCapRowIds, SlideFitAdvisory } from "./slide-fit-advisory";

describe("SlideFitAdvisory", () => {
  it("renders nothing at or under the soft cap", () => {
    const { container } = render(<SlideFitAdvisory count={5} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("slide-fit-advisory")).not.toBeInTheDocument();
  });

  it("renders a quiet advisory note above the soft cap", () => {
    render(<SlideFitAdvisory count={6} />);
    const note = screen.getByTestId("slide-fit-advisory");
    expect(note).toHaveTextContent(
      "6 records may not fit cleanly on the slide",
    );
    expect(note).toHaveAttribute("role", "note");
  });
});

interface Row {
  id: string;
  key?: string;
}

function rows(spec: [id: string, key: string | undefined][]): Row[] {
  return spec.map(([id, key]) => ({ id, key }));
}

describe("firstOverCapRowIds", () => {
  it("flags the FIRST row of each over-cap group exactly once, with counts", () => {
    // Product A has 6 rows (over the cap of 5); product B has 2 (under).
    const data = rows([
      ["a1", "A"],
      ["b1", "B"],
      ["a2", "A"],
      ["a3", "A"],
      ["a4", "A"],
      ["a5", "A"],
      ["a6", "A"],
      ["b2", "B"],
    ]);
    const { firstIds, countByKey } = firstOverCapRowIds(data, (r) => r.key);
    expect([...firstIds]).toEqual(["a1"]);
    expect(countByKey.get("A")).toBe(6);
    expect(countByKey.get("B")).toBe(2);
  });

  it("ignores rows whose group key is undefined", () => {
    const data = rows([
      ["x1", undefined],
      ["x2", undefined],
    ]);
    const { firstIds, countByKey } = firstOverCapRowIds(data, (r) => r.key);
    expect(firstIds.size).toBe(0);
    expect(countByKey.size).toBe(0);
  });

  it("does not flag a group sitting exactly at the cap", () => {
    const data = rows(
      Array.from(
        { length: 5 },
        (_, i) => [`a${String(i)}`, "A"] as [string, string],
      ),
    );
    const { firstIds } = firstOverCapRowIds(data, (r) => r.key);
    expect(firstIds.size).toBe(0);
  });
});
