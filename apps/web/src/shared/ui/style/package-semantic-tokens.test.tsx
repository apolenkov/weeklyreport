import { Badge } from "@customreport/ui/components/ui/badge";
import { Button } from "@customreport/ui/components/ui/button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("package semantic tokens", () => {
  it("uses the destructive foreground and focus contracts", () => {
    render(
      <>
        <Button data-testid="button" variant="destructive" />
        <Badge data-testid="badge" variant="destructive" />
      </>,
    );

    for (const testId of ["button", "badge"]) {
      const element = screen.getByTestId(testId);
      expect(element).toHaveClass("text-destructive-foreground");
      expect(element).toHaveClass("focus-visible:ring-destructive/20");
      expect(element).not.toHaveClass("text-white");
    }
  });
});
