import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ViewModeToggle } from "./view-mode-toggle";
import { ArchiveToggle } from "./archive-toggle";
import { MetaRow } from "./meta-row";
import { AccordionSection } from "./accordion-section";

// ViewModeToggle ----------------------------------------------------------------

describe("ViewModeToggle", () => {
  it("renders Edit link with correct href", () => {
    render(
      <ViewModeToggle editHref="/lead/report/abc" slidesHref="/lead/report/abc?mode=slides" />,
    );
    const edit = screen.getByRole("link", { name: /edit/i });
    expect(edit).toHaveAttribute("href", "/lead/report/abc");
  });

  it("renders Slides link with correct href", () => {
    render(
      <ViewModeToggle editHref="/lead/report/abc" slidesHref="/lead/report/abc?mode=slides" />,
    );
    const slides = screen.getByRole("link", { name: /slides/i });
    expect(slides).toHaveAttribute("href", "/lead/report/abc?mode=slides");
  });
});

// ArchiveToggle -----------------------------------------------------------------

describe("ArchiveToggle", () => {
  it("renders as a switch with aria-checked=false when unchecked", () => {
    render(<ArchiveToggle checked={false} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "false");
  });

  it("renders aria-checked=true when checked", () => {
    render(<ArchiveToggle checked={true} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with toggled value on click", () => {
    const onChange = vi.fn();
    render(<ArchiveToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checked and clicked", () => {
    const onChange = vi.fn();
    render(<ArchiveToggle checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

// MetaRow -----------------------------------------------------------------------

describe("MetaRow", () => {
  it("renders author name", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} />);
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("renders All stages chip when stageTags is empty", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} />);
    expect(screen.getByText("All stages")).toBeDefined();
  });

  it("renders individual stage chips", () => {
    render(<MetaRow authorName="Alice" stageTags={["Planning", "Dev"]} />);
    expect(screen.getByText("Planning")).toBeDefined();
    expect(screen.getByText("Dev")).toBeDefined();
  });

  it("renders empty string when authorName is null", () => {
    const { container } = render(<MetaRow authorName={null} stageTags={[]} />);
    const span = container.querySelector("span.truncate");
    expect(span?.textContent).toBe("");
  });

  it("applies custom className", () => {
    const { container } = render(
      <MetaRow authorName="A" stageTags={[]} className="pt-1" />,
    );
    expect(container.firstChild).toHaveClass("pt-1");
  });
});

// AccordionSection --------------------------------------------------------------

describe("AccordionSection", () => {
  it("renders title and children", () => {
    render(
      <AccordionSection icon={null} title="Risks">
        <p>Content here</p>
      </AccordionSection>,
    );
    expect(screen.getByText("Risks")).toBeDefined();
    expect(screen.getByText("Content here")).toBeDefined();
  });

  it("is expanded by default", () => {
    render(
      <AccordionSection icon={null} title="Risks">
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /risks/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses on click and re-expands on second click", () => {
    render(
      <AccordionSection icon={null} title="Risks">
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /risks/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("renders badge when provided", () => {
    render(
      <AccordionSection icon={null} title="Items" badge="3">
        Content
      </AccordionSection>,
    );
    expect(screen.getByText("3")).toBeDefined();
  });

  it("syncs to groupExpanded when groupSyncKey changes", () => {
    const { rerender } = render(
      <AccordionSection icon={null} title="T" groupSyncKey={0} groupExpanded={true}>
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /^t$/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");

    rerender(
      <AccordionSection icon={null} title="T" groupSyncKey={1} groupExpanded={false}>
        Content
      </AccordionSection>,
    );
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });
});
