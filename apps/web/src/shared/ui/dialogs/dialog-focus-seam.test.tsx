import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@customreport/ui/components/ui/dialog";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function PrimitiveHarness({
  open,
  preventOpenFocus,
}: {
  readonly open: boolean;
  readonly preventOpenFocus: boolean;
}) {
  return (
    <>
      <button type="button" data-testid="first-trigger">
        First trigger
      </button>
      <button type="button" data-testid="second-trigger">
        Second trigger
      </button>
      <Dialog open={open}>
        <DialogContent
          restoreFocusToPrevious={true}
          onOpenAutoFocus={(event) => {
            if (preventOpenFocus) event.preventDefault();
          }}
        >
          <DialogTitle>Primitive focus test</DialogTitle>
          <button type="button">Inside dialog</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("Dialog focus seam", () => {
  it("refreshes the restore target when open autofocus is overridden", async () => {
    const { rerender } = render(
      <PrimitiveHarness open={false} preventOpenFocus={false} />,
    );
    const firstTrigger = screen.getByTestId("first-trigger");
    const secondTrigger = screen.getByTestId("second-trigger");
    firstTrigger.focus();
    rerender(<PrimitiveHarness open={true} preventOpenFocus={false} />);
    screen.getByRole("button", { name: "Inside dialog" }).focus();
    rerender(<PrimitiveHarness open={false} preventOpenFocus={false} />);
    await vi.waitFor(() => expect(firstTrigger).toHaveFocus());

    secondTrigger.focus();
    rerender(<PrimitiveHarness open={true} preventOpenFocus={true} />);
    screen.getByRole("button", { name: "Inside dialog" }).focus();
    rerender(<PrimitiveHarness open={false} preventOpenFocus={true} />);
    await vi.waitFor(() => expect(secondTrigger).toHaveFocus());
  });
});
