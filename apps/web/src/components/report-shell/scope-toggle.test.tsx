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
    expect(screen.getByRole("radio", { name: "Own" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "By product" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "By lead" }),
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
    fireEvent.click(screen.getByRole("radio", { name: "By product" }));
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
    expect(screen.getByRole("radio", { name: "By product" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Own" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("renders all three scopes by default when allowedScopes is omitted", () => {
    const onChange = vi.fn();
    render(<ScopeToggle value={"own"} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Own" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "By product" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "By lead" })).toBeInTheDocument();
  });
});
