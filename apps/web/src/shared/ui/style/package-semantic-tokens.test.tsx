import { Button } from "@customreport/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@customreport/ui/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@customreport/ui/components/ui/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
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

  it("keeps shared overlays above their dimming layers", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Sheet</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass(
      "z-(--layer-dialog)",
    );
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass(
      "z-(--layer-dialog)",
      "overflow-y-auto",
      "overscroll-contain",
    );
  });

  it("uses scoped color transitions for shared controls", () => {
    render(
      <>
        <Button data-testid="transition-button" />
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );

    expect(screen.getByTestId("transition-button")).toHaveClass(
      "transition-colors",
    );
    expect(screen.getByRole("tab")).toHaveClass("transition-colors");
    expect(screen.getByRole("tab")).not.toHaveClass("transition-all");
  });
});
