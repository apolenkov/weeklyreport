import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScopeToggle } from "./scope-toggle";

describe("ScopeToggle", () => {
  it("renders only the allowed scopes", () => {
    render(
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product"]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Product" })).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Leads" }),
    ).not.toBeInTheDocument();
  });

  it("calls onChange with the clicked scope value", () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        value="own"
        onChange={onChange}
        allowedScopes={["own", "product"]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Product" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("product");
  });

  it("marks the active scope as aria-checked", () => {
    render(
      <ScopeToggle
        value="product"
        onChange={vi.fn()}
        allowedScopes={["own", "product"]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Product" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Summary" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("renders all three scopes by default when allowedScopes is omitted", () => {
    const onChange = vi.fn();
    render(<ScopeToggle value={"own"} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Leads" })).toBeInTheDocument();
  });

  it("each scope renders as a button with role='radio'", () => {
    render(
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio.tagName).toBe("BUTTON");
    }
  });

  it("each scope button has type='button'", () => {
    render(
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("type", "button");
    }
  });

  it("container has role='radiogroup' and aria-label='Slide scope'", () => {
    const { container } = render(
      <ScopeToggle value="own" onChange={vi.fn()} />,
    );
    const group = container.firstChild as HTMLElement;
    expect(group).toHaveAttribute("role", "radiogroup");
    expect(group).toHaveAttribute("aria-label", "Slide scope");
  });

  it("active scope button has accent background class; inactive buttons have accent foreground class", () => {
    const { container } = render(
      <ScopeToggle
        value="product"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it("renders index-aware segmented rounding for the two-scope case", () => {
    const { container } = render(
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product"]}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  // toolbar-polish part 4: selecting a header toggle must change only the
  // grouping (onChange), never open an item/risk/decision dialog. The reported
  // "toggle opens a dialog" bug was NOT reproducible (the head report wires no
  // such dialog into the toggle); this is the standing guard.
  it("selecting a scope opens no item/risk/decision dialog", () => {
    const onChange = vi.fn();
    const { baseElement } = render(
      <ScopeToggle
        value="own"
        onChange={onChange}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Leads" }));
    expect(onChange).toHaveBeenCalledWith("lead");
    expect(baseElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
