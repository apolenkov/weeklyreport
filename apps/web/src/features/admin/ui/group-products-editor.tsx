"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import type { MockProduct } from "../../../shared/lib/admin-mock-data";

/**
 * UFB-054 / Phase 56-C: «Products attached» section inside the Groups
 * tab edit dialog.
 *
 * Reads `admin.listGroupProducts({ groupId })` for the current group
 * and renders a checkbox toggle per non-archived product. Products already
 * owned by another group are shown as locked, because the B1 invariant is
 * one owning group per product. Toggling an attached product runs
 * `admin.detachProductFromGroup`; toggling a free product runs
 * `admin.attachProductToGroup`. Both mutations are idempotent on the server
 * (Phase 56-B) so double-clicks are safe.
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
        toast.error(err.message);
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
        toast.error(err.message);
      },
    }),
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== "archived"),
    [products],
  );

  const productGroupsQueries = useQueries({
    queries: activeProducts.map((product) =>
      trpc.admin.listProductGroups.queryOptions({ productId: product.id }),
    ),
  });

  const owningGroupByProductId = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    activeProducts.forEach((product, index) => {
      const owner = productGroupsQueries[index]?.data?.[0];
      if (owner) map.set(product.id, { id: owner.id, name: owner.name });
    });

    return map;
  }, [activeProducts, productGroupsQueries]);

  const isPending = attachMut.isPending || detachMut.isPending;

  function toggle(productId: string, nextChecked: boolean): void {
    const owner = owningGroupByProductId.get(productId);
    if (nextChecked && owner && owner.id !== groupId) {
      toast.error(`Already attached to ${owner.name}`);
      return;
    }

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
        Explicit Group ↔ Product mapping (UFB-054). Toggle to attach or detach
        free products. Products already attached to another group are locked
        here.
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
          {activeProducts.map((product, index) => {
            const checked = attachedIds.has(product.id);
            const owner = owningGroupByProductId.get(product.id);
            const ownershipLoading = productGroupsQueries[index]?.isLoading;
            const lockedByOtherGroup = Boolean(
              owner && owner.id !== groupId && !checked,
            );
            const hintId = `group-product-hint-${product.id}`;
            const disabled =
              isPending || lockedByOtherGroup || ownershipLoading;

            return (
              <li key={product.id}>
                <label
                  className={[
                    "flex items-start gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
                    disabled
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer",
                  ].join(" ")}
                  title={
                    lockedByOtherGroup && owner
                      ? `Already attached to ${owner.name}`
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggle(product.id, e.target.checked)}
                    aria-label={`Toggle ${product.name}`}
                    aria-describedby={
                      lockedByOtherGroup || ownershipLoading
                        ? hintId
                        : undefined
                    }
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                  <span className="min-w-0">
                    <span>{product.name}</span>
                    {lockedByOtherGroup && owner && (
                      <span
                        id={hintId}
                        className="block text-xs text-[var(--color-muted-foreground)]"
                      >
                        Already attached to {owner.name}
                      </span>
                    )}
                    {ownershipLoading && (
                      <span
                        id={hintId}
                        className="block text-xs text-[var(--color-muted-foreground)]"
                      >
                        Checking group assignment…
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
