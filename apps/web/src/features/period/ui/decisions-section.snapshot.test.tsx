/**
 * @vitest-environment jsdom
 *
 * Regression coverage for decision metadata and hidden decorative icons.
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionsSection } from "./decisions-section";

const BASE_DECISION = {
  id: "d1",
  productId: "p1",
  productName: "CRM",
  text: "Adopt new framework",
  owner: "Vasily Lead",
  impact: "Faster delivery",
  deadline: null,
};

describe("DecisionsSection meta-row", () => {
  it("renders decision owner in the left slot of the meta-row", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} readOnly />);
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
  });

  it("renders the 'No stage set' warning pill when stageIds is absent", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} readOnly />);
    expect(screen.getByText("No stage set")).toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
  });

  it("renders specific stage chips alongside the owner in the meta-row", () => {
    render(
      <DecisionsSection
        decisions={[{ ...BASE_DECISION, stageIds: ["Analysis", "Dev"] }]}
        stagesForProduct={() => ["Analysis", "Development"]}
        readOnly
      />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    // stage-label-canonicalization: a stored short "Dev" heals to the canonical
    // "Development" at render (the decision row never shows the short form).
    expect(screen.getByText("Development")).toBeInTheDocument();
  });
});

// Buttons when !readOnly && !foreign (id-based flag, not free-text owner match).
describe("DecisionsSection — EditIcon and DeleteIcon aria-hidden", () => {
  it("EditIcon svg has aria-hidden='true'", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const editButton = screen.getByRole("button", { name: "Edit decision" });
    const svg = editButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("DeleteIcon svg has aria-hidden='true'", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const deleteButton = screen.getByRole("button", {
      name: "Delete decision for CRM",
    });
    const svg = deleteButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Edit button has aria-label='Edit decision' and child svg has aria-hidden='true'", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const editButton = screen.getByRole("button", { name: "Edit decision" });
    expect(editButton).toHaveAttribute("aria-label", "Edit decision");
    const svg = editButton.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Delete button has aria-label matching 'Delete decision for' and child svg has aria-hidden='true'", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const deleteButton = screen.getByRole("button", {
      name: "Delete decision for CRM",
    });
    expect(deleteButton).toHaveAttribute(
      "aria-label",
      "Delete decision for CRM",
    );
    const svg = deleteButton.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Edit button accessible name is 'Edit decision' with no icon content leaking", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    // getByRole resolves by accessible name — if SVG leaked into the name,
    // the name would differ from the aria-label and this query would fail.
    const editButton = screen.getByRole("button", { name: "Edit decision" });
    expect(editButton).toBeInTheDocument();
  });

  it("Delete button accessible name is 'Delete decision for CRM' with no icon SVG paths leaking", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const deleteButton = screen.getByRole("button", {
      name: "Delete decision for CRM",
    });
    expect(deleteButton).toBeInTheDocument();
  });
});

describe("DecisionsSection — Edit and Delete button DOM accessibility tree", () => {
  it("Edit button DOM accessibility tree — icon hidden from a11y tree (snapshot)", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const editButton = screen.getByRole("button", { name: "Edit decision" });
    expect(editButton).toMatchSnapshot();
  });

  it("Delete button DOM accessibility tree — icon hidden from a11y tree (snapshot)", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} />);
    const deleteButton = screen.getByRole("button", {
      name: "Delete decision for CRM",
    });
    expect(deleteButton).toMatchSnapshot();
  });
});

// Own (non-foreign) decisions stay editable regardless of owner string vs signed-in name.
describe("DecisionsSection — own decision stays editable despite owner/name mismatch", () => {
  it("renders Edit and Delete when the owner string differs from currentUserName", () => {
    render(
      <DecisionsSection
        decisions={[{ ...BASE_DECISION, owner: "Василий И." }]}
        currentUserName="Иванов Василий Петрович"
        readOnly={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Edit decision" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete decision for CRM" }),
    ).toBeInTheDocument();
    // The old "Owner: … — read-only for you" marker must be gone.
    expect(screen.queryByText(/Owner:/)).not.toBeInTheDocument();
  });

  it("hides Edit/Delete and shows the lock badge for a foreign decision", () => {
    render(
      <DecisionsSection
        decisions={[{ ...BASE_DECISION, owner: "Мария К.", foreign: true }]}
        currentUserName="Иванов Василий Петрович"
        readOnly={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Edit decision" }),
    ).not.toBeInTheDocument();
  });
});
