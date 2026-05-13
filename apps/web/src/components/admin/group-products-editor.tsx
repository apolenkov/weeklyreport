"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";

import type { MockProduct } from "./mock-data";

/**
 * UFB-054 / Phase 56-C: «Products attached» section inside the Groups
 * tab edit dialog.
 *
 * Reads `admin.listGroupProducts({ groupId })` for the current group
 * and renders a checkbox toggle per non-archived product. Toggling an
 * attached product runs `admin.detachProductFromGroup`; toggling an
 * unattached product runs `admin.attachProductToGroup`. Both mutations
 * are idempotent on the server (Phase 56-B) so double-clicks are safe.
 *
 * The component is intentionally self-contained — it owns its own
 * query/cache key and does not coordinate with the parent `GroupsTab`
 * outside the simple `(groupId, products[])` contract. This keeps the
 * blast radius of 56-C tiny and lets the broader admin-snapshot cache
 * (queried by the rest of the admin tabs) stay untouched.
 */
export function GroupProductsEditor({
  groupId,
  products,
}: {
  readonly groupId: string;
  readonly products: readonly MockProduct[];
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const attachedQuery = useQuery(
    trpc.admin.listGroupProducts.queryOptions({ groupId }),
  );

  const attachedIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of attachedQuery.data ?? []) set.add(row.id);
    return set;
  }, [attachedQuery.data]);

  const attachMut = useMutation(
    trpc.admin.attachProductToGroup.mutationOptions({
      onSuccess: async (_data, variables) => {
        // Attach may be a reassign (B1 invariant: product moves from old
        // group to new group). Invalidate ALL listGroupProducts queries so
        // the old group's list also refreshes, not just the current group.
        await Promise.all([
          qc.invalidateQueries(trpc.admin.listGroupProducts.pathFilter()),
          qc.invalidateQueries({
            queryKey: trpc.admin.listProductGroups.queryKey({
              productId: variables.productId,
            }),
          }),
        ]);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to attach product");
      },
    }),
  );

  const detachMut = useMutation(
    trpc.admin.detachProductFromGroup.mutationOptions({
      onSuccess: async (_data, variables) => {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: trpc.admin.listGroupProducts.queryKey({ groupId }),
          }),
          qc.invalidateQueries({
            queryKey: trpc.admin.listProductGroups.queryKey({
              productId: variables.productId,
            }),
          }),
        ]);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to detach product");
      },
    }),
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== "archived"),
    [products],
  );

  const isPending = attachMut.isPending || detachMut.isPending;

  function toggle(productId: string, nextChecked: boolean): void {
    if (nextChecked) {
      attachMut.mutate({ groupId, productId });
    } else {
      detachMut.mutate({ groupId, productId });
    }
  }

  return (
    <fieldset
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
      data-testid="group-products-editor"
    >
      <legend className="px-1 text-sm font-medium text-[var(--color-foreground)]">
        Products attached
      </legend>
      <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
        Explicit Group ↔ Product mapping (UFB-054). Toggle to attach or
        detach. Independent of product lead — a product belongs to exactly
        one group (B1 invariant: @@unique([productId])).
      </p>
      {attachedQuery.isLoading ? (
        <div
          className="py-1 text-xs text-[var(--color-muted-foreground)]"
          data-testid="group-products-loading"
        >
          Loading…
        </div>
      ) : activeProducts.length === 0 ? (
        <div className="py-1 text-xs text-[var(--color-muted-foreground)]">
          No active products yet. Create one in the Products tab first.
        </div>
      ) : (
        <ul
          className="max-h-40 space-y-1 overflow-y-auto pr-1"
          data-testid="group-products-list"
        >
          {activeProducts.map((product) => {
            const checked = attachedIds.has(product.id);
            return (
              <li key={product.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isPending}
                    onChange={(e) => toggle(product.id, e.target.checked)}
                    aria-label={`Toggle ${product.name}`}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                  <span>{product.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
