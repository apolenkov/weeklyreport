/**
 * @vitest-environment jsdom
 *
 * Pre-extract snapshot: MetaRow [author | stage chips] in PrioritiesSection.
 * Baseline before Wave 1 A2 extracts this markup to report-shell/meta-row.tsx.
 * After extraction, these tests must pass without changes.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrioritiesSection } from "./priorities-section";

const BASE_PRIORITY = {
  rank: 1,
  text: "Ship API v2",
};

describe("PrioritiesSection meta-row — pre-extract snapshot", () => {
  it("renders author name in the left slot of the meta-row", () => {
    render(
      <PrioritiesSection
        priorities={[BASE_PRIORITY]}
        sectionAuthorName="Anna Lead"
        readOnly
      />,
    );
    expect(screen.getByText("Anna Lead")).toBeInTheDocument();
  });

  it("renders All-stages pill when stageIds is absent", () => {
    const { container } = render(
      <PrioritiesSection
        priorities={[BASE_PRIORITY]}
        sectionAuthorName="Anna Lead"
        readOnly
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
        readOnly
      />,
    );
    expect(screen.getByText("Anna Lead")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    const row = container.querySelector('[aria-label^="Priority 1 stages:"]');
    expect(row).toMatchSnapshot();
  });
});
