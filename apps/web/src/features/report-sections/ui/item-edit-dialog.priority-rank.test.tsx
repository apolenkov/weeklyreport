import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemEditDialog } from "./item-edit-dialog";

const products = [
  {
    id: "p1",
    name: "Product 1",
    overallStatus: "on-track" as const,
    stages: [],
  },
];

describe("ItemEditDialog priority rank", () => {
  it.each(["2foo", "invalid"])(
    "normalizes a malformed priority rank value %s to no rank",
    (malformed) => {
      const onSave = vi.fn();
      render(
        <ItemEditDialog
          open={true}
          item={null}
          products={products}
          week="current"
          defaultProductId="p1"
          stagesForProduct={() => ["Dev"]}
          onSave={onSave}
          onCancel={() => undefined}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Description \*/i), {
        target: { value: "Malformed priority item" },
      });
      // A native select only offers integer ranks, so the malformed option is
      // injected to reach the change handler the way a tampered control would.
      const select = screen.getByLabelText<HTMLSelectElement>(/Priority rank/i);
      select.add(new Option(malformed, malformed));
      fireEvent.change(select, { target: { value: malformed } });
      fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0]?.[0]).toMatchObject({ priorityRank: null });
    },
  );
});
