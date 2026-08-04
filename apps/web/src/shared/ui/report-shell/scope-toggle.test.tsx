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

  it("only the checked radio is in the tab order (roving tabindex)", () => {
    render(
      <ScopeToggle
        value="product"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Product" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "Summary" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("ArrowRight selects and wraps to the next scope", () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        value="lead"
        onChange={onChange}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Leads" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("own");
  });

  it("ArrowLeft selects the previous scope", () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        value="product"
        onChange={onChange}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Product" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("own");
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

  it("renders all three scopes when the full list is allowed", () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        value={"own"}
        onChange={onChange}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
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
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    const group = container.firstChild as HTMLElement;
    expect(group).toHaveAttribute("role", "radiogroup");
    expect(group).toHaveAttribute("aria-label", "Slide scope");
  });

  it("active scope button has accent background class; inactive buttons have accent foreground class", () => {
    render(
      <ScopeToggle
        value="product"
        onChange={vi.fn()}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Product" })).toHaveClass(
      "bg-[var(--color-toggle-active)]",
      "text-[var(--color-primary-foreground)]",
    );
    for (const name of ["Summary", "Leads"]) {
      expect(screen.getByRole("radio", { name })).toHaveClass(
        "text-[var(--color-muted-foreground)]",
        "hover:text-[var(--color-foreground)]",
      );
    }
  });

  it("uses a pill-shaped track and uniform segment rounding for two scopes", () => {
    render(
      <ScopeToggle
        value="own"
        onChange={vi.fn()}
        allowedScopes={["own", "product"]}
      />,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass(
      "rounded-[var(--radius-pill)]",
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveClass("rounded-[var(--radius-pill)]");
      expect(radio.className).not.toMatch(/rounded-[lr]-/);
    }
  });

  it("ignores keys outside the radiogroup navigation set", () => {
    const onChange = vi.fn();
    render(
      <ScopeToggle
        value="own"
        onChange={onChange}
        allowedScopes={["own", "product", "lead"]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Summary" }), {
      key: "Enter",
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
