import { Button } from "@customreport/ui/components/ui/button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("package semantic tokens", () => {
  it("uses the destructive foreground and focus contracts", () => {
    render(<Button data-testid="button" variant="destructive" />);

    const element = screen.getByTestId("button");
    expect(element).toHaveClass("text-destructive-foreground");
    expect(element).toHaveClass("focus-visible:ring-destructive/20");
    expect(element).not.toHaveClass("text-white");
  });
});
