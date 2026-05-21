/**
 * @vitest-environment jsdom
 *
 * Snapshot: MetaRow [author | stage chips] in PrioritiesSection (read-only derived view).
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrioritiesSection } from "./priorities-section";

const BASE_PRIORITY = {
  rank: 1,
  text: "Ship API v2",
};

describe("PrioritiesSection meta-row — snapshot", () => {
  it("renders author name in the left slot of the meta-row", () => {
    render(
      <PrioritiesSection
        priorities={[BASE_PRIORITY]}
        sectionAuthorName="Anna Lead"
      />,
    );
    expect(screen.getByText("Anna Lead")).toBeInTheDocument();
  });

  it("renders All-stages pill when stageIds is absent", () => {
    const { container } = render(
      <PrioritiesSection
        priorities={[BASE_PRIORITY]}
        sectionAuthorName="Anna Lead"
      />,
    );
    expect(screen.getByText("All stages")).toBeInTheDocument();
    const row = container.querySelector('[aria-label^="Priority 1 stages:"]');
    expect(row).toMatchSnapshot();
  });

  it("renders specific stage chips alongside the author in the meta-row", () => {
    const { container } = render(
      <PrioritiesSection
        priorities={[{ ...BASE_PRIORITY, stageIds: ["Design", "Testing"] }]}
        sectionAuthorName="Anna Lead"
      />,
    );
    expect(screen.getByText("Anna Lead")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    const row = container.querySelector('[aria-label^="Priority 1 stages:"]');
    expect(row).toMatchSnapshot();
  });
});
