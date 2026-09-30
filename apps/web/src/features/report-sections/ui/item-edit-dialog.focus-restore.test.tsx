// Discarding a dirty draft closes both dialog levels and returns focus to the
// Edit button that opened the editor.

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { PortalTargetProvider } from "../../../shared/ui/dialogs/document-body-portal";
import { RiskEditDialog } from "../../review";
import type { Product } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
];

function Harness({ kind }: { readonly kind: "item" | "risk" }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const common = {
    open,
    products,
    stagesForProduct: () => ["Dev"],
    onSave: () => undefined,
    onCancel: () => setOpen(false),
  };
  return (
    <main tabIndex={-1}>
      <button type="button" onClick={() => setOpen(true)}>
        Edit
      </button>
      <PortalTargetProvider target={target}>
        {kind === "item" ? (
          <ItemEditDialog
            {...common}
            item={{
              id: "item-1",
              parent: { kind: "product", id: "p1" },
              productId: "p1",
              productName: "DevOps Tools",
              activityId: null,
              stageNames: ["Dev"],
              status: "in-progress",
              text: "Deploy the pipeline",
              author: "Test Lead",
            }}
            week="current"
            defaultProductId="p1"
          />
        ) : (
          <RiskEditDialog {...common} risk={null} defaultProductId="p1" />
        )}
      </PortalTargetProvider>
      <div ref={setTarget} className="contents" />
    </main>
  );
}

describe.each(["item", "risk"] as const)("%s editor discard focus", (kind) => {
  it("restores focus to Edit after backdrop, Keep editing, Escape, Discard", async () => {
    const user = userEvent.setup();
    render(<Harness kind={kind} />);
    const edit = screen.getByRole("button", { name: "Edit" });
    edit.focus();
    await user.click(edit);

    const field = document.querySelector<HTMLTextAreaElement>("textarea");
    if (!field) throw new Error("editor field missing");
    fireEvent.change(field, { target: { value: "changed" } });
    const backdrop = screen.getByRole("dialog").parentElement;
    if (!backdrop) throw new Error("backdrop missing");
    await user.click(backdrop);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(edit).toHaveFocus();
  });

  it.each(["pointer", "Enter"] as const)(
    "restores focus to Edit after Escape then Discard (%s)",
    async (activation) => {
      const user = userEvent.setup();
      render(<Harness kind={kind} />);
      const edit = screen.getByRole("button", { name: "Edit" });
      edit.focus();
      if (activation === "pointer") await user.click(edit);
      else await user.keyboard("{Enter}");

      const field = document.querySelector<HTMLTextAreaElement>("textarea");
      if (!field) throw new Error("editor field missing");
      fireEvent.change(field, { target: { value: "changed" } });
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Discard" }));

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(edit).toBeInTheDocument();
      expect(edit).toHaveFocus();
    },
  );
});
