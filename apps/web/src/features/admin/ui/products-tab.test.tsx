import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import { ProductsTab } from "./products-tab";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock heavy child components so their own queries don't pollute the
// environment. We stub them with lightweight divs that preserve any
// data-testid attributes the parent tree might depend on.
vi.mock("./product-group-chips", () => ({
  ProductGroupChips: () => <div data-testid="product-group-chips-stub" />,
}));

vi.mock("./stage-assignments/stage-assignment-editor", () => ({
  StageAssignmentEditor: () => (
    <div data-testid="stage-assignment-editor-stub" />
  ),
}));

vi.mock("../../../shared/ui/search/search-input", () => ({
  SearchInput: () => <div data-testid="search-input-stub" />,
}));

vi.mock("../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    onCancel,
  }: {
    readonly open: boolean;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

const LEAD_ID = "u-lead-1";
const INACTIVE_LEAD_ID = "u-lead-inactive";
const PRODUCT_ID = "p-product-1";
const SECOND_PRODUCT_ID = "p-product-2";

const mockLead: AdminUserView = {
  id: LEAD_ID,
  name: "Alice",
  lastName: "Alice",
  firstName: "Lead",
  middleName: null,
  position: null,
  email: "alice@example.com",
  role: "lead",
  groupId: "g1",
  department: "Engineering",
  isActive: true,
};

const inactiveLead: AdminUserView = {
  ...mockLead,
  id: INACTIVE_LEAD_ID,
  name: "Bob",
  lastName: "Bob",
  isActive: false,
};

const mockProduct: AdminProductView = {
  id: PRODUCT_ID,
  name: "Test Product",
  leadOwnerId: LEAD_ID,
  stages: [],
  status: "active",
};

const secondProduct: AdminProductView = {
  ...mockProduct,
  id: SECOND_PRODUCT_ID,
  name: "Second Product",
};

function renderTab(opts?: {
  products?: AdminProductView[];
  users?: AdminUserView[];
  productFilter?: string | null;
  countsError?: boolean;
}) {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["admin", "listStageAssignmentCounts"],
      query: opts?.countsError
        ? Promise.reject(new Error("counts failed"))
        : [],
    },
    { path: ["admin", "saveProject"], mutation: true },
    { path: ["admin", "deleteProject"], mutation: true },
    // Minimal stubs for other admin paths that invalidateAdmin may touch.
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <ProductsTab
      products={opts?.products ?? [mockProduct]}
      users={opts?.users ?? [mockLead]}
      productFilter={opts?.productFilter ?? null}
    />,
    { wrapper: Wrapper },
  );
  return { ...result, captured };
}

describe("ProductsTab — deep-link panel state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-expands the deep-linked product on initial load", () => {
    renderTab({ productFilter: PRODUCT_ID });

    expect(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("stage-assignment-editor-stub"),
    ).toBeInTheDocument();
  });

  it("keeps a manually collapsed deep-linked product closed after a refetch", async () => {
    const user = userEvent.setup();
    const products = [mockProduct];
    const { rerender } = renderTab({ products, productFilter: PRODUCT_ID });

    await user.click(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    );

    rerender(
      <ProductsTab
        products={products.map((product) => ({ ...product }))}
        users={[mockLead]}
        productFilter={PRODUCT_ID}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Expand stage assignments for ${mockProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("stage-assignment-editor-stub"),
    ).not.toBeInTheDocument();
  });

  it("auto-expands and guards a genuinely new deep-link target", async () => {
    const user = userEvent.setup();
    const products = [mockProduct, secondProduct];
    const { rerender } = renderTab({ products, productFilter: PRODUCT_ID });

    await user.click(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    );
    rerender(
      <ProductsTab
        products={products}
        users={[mockLead]}
        productFilter={SECOND_PRODUCT_ID}
      />,
    );

    const secondProductToggle = screen.getByRole("button", {
      name: `Collapse stage assignments for ${secondProduct.name}`,
    });
    expect(secondProductToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(secondProductToggle);
    rerender(
      <ProductsTab
        products={products.map((product) => ({ ...product }))}
        users={[mockLead]}
        productFilter={SECOND_PRODUCT_ID}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Expand stage assignments for ${secondProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ProductsTab — Add/Edit dialog a11y", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escape keydown on document closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Fire Escape on the document — the useEffect listener should close it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel button click closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking the backdrop (role=presentation) closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The backdrop is the outer div with role="presentation".
    await user.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking inside the dialog (role=dialog) does NOT close it (stopPropagation)", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Click the inner dialog container itself — stopPropagation should
    // prevent the backdrop onClick from firing.
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the dialog open on Escape and backdrop click while Save is pending", async () => {
    const { captured } = renderTab({ products: [] });
    captured["admin.saveProject"]?.mutationFn.mockReturnValue(
      new Promise<never>(() => undefined),
    );

    openAddAndPickLead();
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks the submitted draft while pending and unlocks it unchanged after failure", async () => {
    const deferred = Promise.withResolvers<unknown>();
    const { captured } = renderTab({ products: [] });
    captured["admin.saveProject"]?.mutationFn.mockReturnValue(deferred.promise);
    const user = userEvent.setup();

    openAddAndPickLead();
    const name = screen.getByLabelText(/product name/i);
    await user.click(screen.getByRole("button", { name: "Add product" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(name).toBeDisabled();
    await user.click(name);
    await user.keyboard("Unsent replacement");
    expect(name).toHaveValue("New Product");
    expect(captured["admin.saveProject"]?.calls[0]).toMatchObject({
      name: "New Product",
      leadId: LEAD_ID,
    });

    act(() => deferred.reject(new Error("save failed")));
    await waitFor(() => expect(name).toBeEnabled());
    expect(name).toHaveValue("New Product");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ProductsTab — focus management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves focus to the product name when the dialog opens", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    const input = screen.getByLabelText(/product name/i);
    // The shared dialog-focus hook moves focus to the first enabled control.
    expect(input).toHaveFocus();
  });

  it("focus returns to the trigger button after the dialog closes via Cancel", async () => {
    const user = userEvent.setup();
    renderTab();

    const addBtn = screen.getByRole("button", { name: /add new product/i });
    addBtn.focus();
    await user.click(addBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });

  it("focus returns to the trigger button after the dialog closes via Escape", async () => {
    const user = userEvent.setup();
    renderTab();

    const addBtn = screen.getByRole("button", { name: /add new product/i });
    addBtn.focus();
    await user.click(addBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });
});

function openAddAndPickLead() {
  const addBtn = screen.getByRole("button", { name: /add new product/i });
  fireEvent.click(addBtn);
  fireEvent.change(screen.getByLabelText(/lead owner/i), {
    target: { value: LEAD_ID },
  });
  fireEvent.change(screen.getByLabelText(/product name/i), {
    target: { value: "New Product" },
  });
}

describe("ProductsTab — slide-capacity advisory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function ownedProducts(n: number): AdminProductView[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `p-${String(i)}`,
      name: `Product ${String(i)}`,
      leadOwnerId: LEAD_ID,
      stages: [],
      status: "active" as const,
    }));
  }

  it("shows the over-capacity advisory at the recommended max; Save stays enabled once a lead is chosen", () => {
    renderTab({ products: ownedProducts(6) });

    openAddAndPickLead();

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add product" })).toBeEnabled();
  });

  it("starts the add dialog with no preselected owner and blocks save until one is chosen", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "New Product" },
    });

    // The owner select is unselected — an accidental save cannot bind the new
    // product to the first lead on the list even though the name is filled.
    expect(screen.getByLabelText(/lead owner/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add product" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/lead owner/i), {
      target: { value: LEAD_ID },
    });
    expect(screen.getByRole("button", { name: "Add product" })).toBeEnabled();
  });

  it("shows no over-capacity advisory below the recommended ceiling", () => {
    renderTab({ products: ownedProducts(3) });

    openAddAndPickLead();

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "3 of 6 products",
    );
    expect(
      screen.queryByTestId("lead-product-overcap"),
    ).not.toBeInTheDocument();
  });

  it("counts the lead's products from the FULL set, not a filtered view", () => {
    // productFilter narrows the visible list to a single product…
    renderTab({ products: ownedProducts(6), productFilter: "p-0" });

    openAddAndPickLead();

    // …but the advisory still counts all six products the lead owns.
    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
  });

  it("surfaces the stage-count query failure instead of showing zero counts", async () => {
    renderTab({ countsError: true });

    expect(
      await screen.findByText(/Could not load stage assignment counts/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\/7 stages/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Stages unavailable").length).toBeGreaterThan(0);
  });
});

describe("ProductsTab — retained owner in edit dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a deactivated current owner visible as a disabled option without widening replacements", async () => {
    const user = userEvent.setup();
    const productWithInactiveOwner: AdminProductView = {
      ...mockProduct,
      leadOwnerId: INACTIVE_LEAD_ID,
    };
    renderTab({
      products: [productWithInactiveOwner],
      users: [mockLead, inactiveLead],
    });

    await user.click(
      screen.getByRole("button", { name: `Edit ${mockProduct.name}` }),
    );

    // The deactivated owner still holds the slot: the select keeps the value
    // via one disabled retained option; active leads stay the only selectable
    // replacements.
    const select = screen.getByLabelText(/lead owner/i);
    expect(select).toHaveValue(INACTIVE_LEAD_ID);
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    const retained = within(select).getByRole("option", { name: "Bob L." });
    expect(retained).toHaveValue(INACTIVE_LEAD_ID);
    expect(retained).toBeDisabled();
    expect(
      within(select).getByRole("option", { name: "Alice L." }),
    ).toBeEnabled();
  });
});

describe("ProductsTab — unresolved lead owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a vanished lead as a disabled unavailable option until the admin reselects", async () => {
    const replacementLead: AdminUserView = {
      ...mockLead,
      id: "u-lead-2",
      name: "Carol",
      lastName: "Carol",
    };
    const user = userEvent.setup();
    const { rerender, captured } = renderTab({
      products: [],
      users: [mockLead],
    });

    openAddAndPickLead();

    // A users refresh drops the picked lead while the draft keeps its id.
    rerender(
      <ProductsTab
        products={[]}
        users={[replacementLead]}
        productFilter={null}
      />,
    );

    // The stale id stays the select's value via a disabled unavailable
    // option; Carol is a genuinely different, enabled choice.
    const select = screen.getByLabelText(/lead owner/i);
    expect(select).toHaveValue(LEAD_ID);
    const staleOption = within(select).getByRole("option", {
      name: /unavailable/i,
    });
    expect(staleOption).toHaveValue(LEAD_ID);
    expect(staleOption).toBeDisabled();
    expect(
      within(select).getByRole("option", { name: "Carol L." }),
    ).toBeEnabled();

    // Save is still blocked instead of silently submitting Carol.
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(captured["admin.saveProject"]?.calls).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/lead/i));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/product name/i)).toHaveValue("New Product");

    // A real user change picks Carol — the DOM value actually differs now.
    await user.selectOptions(select, replacementLead.id);
    await user.click(screen.getByRole("button", { name: "Add product" }));

    await waitFor(() =>
      expect(captured["admin.saveProject"]?.calls).toHaveLength(1),
    );
    expect(captured["admin.saveProject"]?.calls[0]).toMatchObject({
      name: "New Product",
      leadId: replacementLead.id,
      leadName: "Carol",
    });
  });

  it("blocks Restore with a toast when the product owner is missing from the users list", async () => {
    const orphanedArchived: AdminProductView = {
      ...mockProduct,
      status: "archived",
      leadOwnerId: "u-missing-owner",
    };
    const user = userEvent.setup();
    const { captured } = renderTab({
      products: [orphanedArchived],
      users: [mockLead],
    });

    await user.click(
      screen.getByRole("button", { name: `Restore ${orphanedArchived.name}` }),
    );

    expect(captured["admin.saveProject"]?.calls).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/lead/i));
  });
});
