import { render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { describe, expect, it } from "vitest";

// TASK-503.81 C5363: the primitives style with the presence selector
// `data-[inset]:pl-8`, so `inset={false}` must not emit the attribute at all.
function renderMenu(inset: boolean | undefined) {
  // exactOptionalPropertyTypes: pass the prop only when it is defined.
  const insetProp = inset === undefined ? {} : { inset };
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel {...insetProp}>Label</DropdownMenuLabel>
        <DropdownMenuItem {...insetProp}>Item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return [screen.getByText("Label"), screen.getByRole("menuitem")];
}

describe("DropdownMenu inset presence attribute", () => {
  it.each([false, undefined])(
    "omits data-inset on label and item when inset=%s",
    (inset) => {
      for (const el of renderMenu(inset)) {
        expect(el).not.toHaveAttribute("data-inset");
      }
    },
  );

  it("marks label and item inset when inset is true", () => {
    for (const el of renderMenu(true)) {
      expect(el).toHaveAttribute("data-inset");
    }
  });
});
