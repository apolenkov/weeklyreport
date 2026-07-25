import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccordionSection } from "./accordion-section";
import { ArchiveToggle } from "./archive-toggle";
import { MetaRow } from "./meta-row";
import { ViewModeToggle } from "./view-mode-toggle";

// ViewModeToggle ----------------------------------------------------------------

describe("ViewModeToggle", () => {
  it("renders Edit link with correct href", () => {
    render(
      <ViewModeToggle
        editHref="/lead/report/abc"
        slidesHref="/lead/report/abc?mode=slides"
      />,
    );
    const edit = screen.getByRole("link", { name: /edit/i });
    expect(edit).toHaveAttribute("href", "/lead/report/abc");
  });

  it("renders Slides link with correct href", () => {
    render(
      <ViewModeToggle
        editHref="/lead/report/abc"
        slidesHref="/lead/report/abc?mode=slides"
      />,
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
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders All stages chip when stageTags is empty", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} />);
    expect(screen.getByText("All stages")).toBeInTheDocument();
  });

  it("renders individual stage chips", () => {
    render(<MetaRow authorName="Alice" stageTags={["Planning", "Dev"]} />);
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
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
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("Content here")).toBeInTheDocument();
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
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("mirrors groupExpanded into local state when it changes", () => {
    const { rerender } = render(
      <AccordionSection icon={null} title="T" groupExpanded={true}>
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /^t$/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");

    rerender(
      <AccordionSection icon={null} title="T" groupExpanded={false}>
        Content
      </AccordionSection>,
    );
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("ChevronDown SVG inside primary toggle button has aria-hidden='true' (no actions)", () => {
    const { container } = render(
      <AccordionSection icon={null} title="Risks">
        Content
      </AccordionSection>,
    );
    const svg = container.querySelector("button svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("primary toggle button has role=button and aria-expanded reflecting state", () => {
    render(
      <AccordionSection icon={null} title="Items" defaultOpen={false}>
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /items/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("secondary chevron button has aria-expanded, aria-label, and ChevronDown with aria-hidden when actions provided", () => {
    render(
      <AccordionSection
        icon={null}
        title="Tasks"
        actions={<button type="button">Action</button>}
      >
        Content
      </AccordionSection>,
    );
    const chevronBtn = screen.getByRole("button", {
      name: /expand tasks|collapse tasks/i,
    });
    expect(chevronBtn).toHaveAttribute("aria-expanded");
    expect(chevronBtn).toHaveAttribute("aria-label");
    const svg = chevronBtn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("main toggle button exposes aria-expanded for screen readers and SVG is hidden from a11y tree", () => {
    render(
      <AccordionSection icon={null} title="Decisions" defaultOpen={true}>
        Content
      </AccordionSection>,
    );
    const btn = screen.getByRole("button", { name: /decisions/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    // SVG must not be announced (aria-hidden suppresses it from AT)
    const svg = btn.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("secondary chevron button aria-label reflects Expand/Collapse + title for screen readers", () => {
    const { rerender } = render(
      <AccordionSection
        icon={null}
        title="Blockers"
        defaultOpen={true}
        actions={<span>act</span>}
      >
        Content
      </AccordionSection>,
    );
    const chevronBtn = screen.getByRole("button", {
      name: /collapse blockers/i,
    });
    expect(chevronBtn).toHaveAttribute("aria-label", "Collapse Blockers");

    fireEvent.click(chevronBtn);
    expect(chevronBtn).toHaveAttribute("aria-label", "Expand Blockers");

    rerender(
      <AccordionSection
        icon={null}
        title="Blockers"
        defaultOpen={false}
        actions={<span>act</span>}
      >
        Content
      </AccordionSection>,
    );
    expect(
      screen.getByRole("button", { name: /expand blockers/i }),
    ).toHaveAttribute("aria-label", "Expand Blockers");
  });

  it("snapshot: AccordionSection with no actions", () => {
    const { container } = render(
      <AccordionSection icon={null} title="Risks" defaultOpen={true}>
        <p>Child content</p>
      </AccordionSection>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot: AccordionSection with actions (two ChevronDowns, both aria-hidden)", () => {
    const { container } = render(
      <AccordionSection
        icon={null}
        title="Tasks"
        defaultOpen={true}
        actions={<button type="button">+ Add</button>}
      >
        <p>Child content</p>
      </AccordionSection>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// MetaRow accessibility --------------------------------------------------------

describe("MetaRow a11y", () => {
  it("root container div has role='group'", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} />);
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("root container has aria-label matching ariaLabel prop", () => {
    render(
      <MetaRow authorName="Alice" stageTags={[]} ariaLabel="Section meta" />,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-label", "Section meta");
  });

  it("div is accessible via getByRole('group', { name }) when ariaLabel given", () => {
    render(
      <MetaRow
        authorName="Bob"
        stageTags={["S1"]}
        ariaLabel="Items section meta"
      />,
    );
    expect(
      screen.getByRole("group", { name: "Items section meta" }),
    ).toBeInTheDocument();
  });

  it("group role container receives aria-label when ariaLabel prop is provided", () => {
    const { container } = render(
      <MetaRow authorName="X" stageTags={[]} ariaLabel="My label" />,
    );
    expect(container.firstChild).toHaveAttribute("role", "group");
    expect(container.firstChild).toHaveAttribute("aria-label", "My label");
  });

  it("foreign indicator span has role='img' when foreign=true and authorName truthy", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} foreign={true} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("foreign indicator span has aria-label='Read-only — authored by another lead'", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} foreign={true} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Read-only — authored by another lead",
    );
  });

  it("foreign indicator absent when foreign=false", () => {
    render(<MetaRow authorName="Alice" stageTags={[]} foreign={false} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("foreign indicator absent when authorName is null even with foreign=true", () => {
    render(<MetaRow authorName={null} stageTags={[]} foreign={true} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("foreign indicator absent when authorName is undefined even with foreign=true", () => {
    render(<MetaRow authorName={undefined} stageTags={[]} foreign={true} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("group role container has no aria-label when ariaLabel prop is undefined", () => {
    const { container } = render(<MetaRow authorName="Y" stageTags={[]} />);
    expect(container.firstChild).toHaveAttribute("role", "group");
    expect(container.firstChild).not.toHaveAttribute("aria-label");
  });

  it("snapshot: root structure with role='group'", () => {
    const { container } = render(
      <MetaRow
        authorName="Alice"
        stageTags={["Planning"]}
        ariaLabel="Test meta"
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot: foreign indicator with role='img' when foreign=true", () => {
    const { container } = render(
      <MetaRow authorName="Alice" stageTags={[]} foreign={true} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
