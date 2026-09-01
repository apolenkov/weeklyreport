import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

const themePath = [
  path.resolve(process.cwd(), "../../packages/ui/src/styles/theme.css"),
  path.resolve(process.cwd(), "packages/ui/src/styles/theme.css"),
].find((candidate) => existsSync(candidate));

if (!themePath) {
  throw new Error("Could not locate packages/ui/src/styles/theme.css");
}

const theme = readFileSync(themePath, "utf8");

function layerValue(name: string): number {
  const match = new RegExp(String.raw`--layer-${name}:\s*(\d+)`).exec(theme);
  if (!match?.[1]) throw new Error(`Missing theme token --layer-${name}`);
  return Number(match[1]);
}

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

  it("keeps toasts above modal dialogs", () => {
    expect(layerValue("toast")).toBeGreaterThan(layerValue("dialog"));
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
