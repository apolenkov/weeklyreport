import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportToolbar } from "./report-toolbar";

describe("ReportToolbar", () => {
  it("renders document actions and context controls in two labeled rows", () => {
    render(
      <ReportToolbar
        documentActions={<button type="button">Submit Section</button>}
        contextControls={<button type="button">Edit</button>}
      />,
    );
    const documentRow = screen.getByRole("group", { name: "Document actions" });
    const contextRow = screen.getByRole("group", { name: "Context controls" });
    expect(documentRow).toContainElement(
      screen.getByRole("button", { name: "Submit Section" }),
    );
    expect(contextRow).toContainElement(
      screen.getByRole("button", { name: "Edit" }),
    );
  });

  it("places the document-action row before the context-control row (focus order)", () => {
    render(
      <ReportToolbar
        documentActions={<span>Doc</span>}
        contextControls={<span>Ctx</span>}
      />,
    );
    const documentRow = screen.getByRole("group", { name: "Document actions" });
    const contextRow = screen.getByRole("group", { name: "Context controls" });
    // The document-action row must precede the context-control row in the DOM
    // so keyboard focus traverses it first (no manual tabindex).
    expect(
      documentRow.compareDocumentPosition(contextRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits a row when its slot is undefined", () => {
    render(<ReportToolbar contextControls={<span>Ctx</span>} />);
    expect(
      screen.queryByRole("group", { name: "Document actions" }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeDefined();
  });

  it("each row scrolls horizontally so controls stay reachable at narrow widths", () => {
    render(
      <ReportToolbar
        documentActions={<span>Doc</span>}
        contextControls={<span>Ctx</span>}
      />,
    );
    const documentRow = screen.getByRole("group", { name: "Document actions" });
    const contextRow = screen.getByRole("group", { name: "Context controls" });
    expect(documentRow.className).toContain("overflow-x-auto");
    expect(contextRow.className).toContain("overflow-x-auto");
  });

  it("root keeps the shared toolbar container signature", () => {
    const { container } = render(<ReportToolbar />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-testid")).toBe("report-toolbar");
    expect(root.className).toContain("rounded-");
    expect(root.className).toContain("flex-col");
  });
});
