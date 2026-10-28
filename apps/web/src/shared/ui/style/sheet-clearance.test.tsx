import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { describe, expect, it } from "vitest";

import { MobileNav } from "../navigation/mobile-nav";

// TASK-503.81 C5362: SheetHeader must provide right clearance for the absolute close
// button (top-2 right-2 size-11) so long titles do not underlap the close control.
describe("SheetHeader close clearance (C5362)", () => {
  it("provides default right clearance (pr-14) on SheetHeader", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader data-testid="header">
            <SheetTitle>Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    const header = document.querySelector('[data-slot="sheet-header"]');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("pr-14");
  });

  it("retains right clearance in MobileNav SheetHeader when opened", async () => {
    const user = userEvent.setup();
    render(<MobileNav links={[]} pathname="/" role="lead" />);

    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const header = document.querySelector('[data-slot="sheet-header"]');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("pr-14");
    expect(header).toHaveClass("p-4");
  });
});
