"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { AdminProductView } from "../model/admin-types";
import { invalidateGroupProductOwnership } from "../model/group-products-invalidation";

export interface OwningGroup {
  readonly id: string;
  readonly name: string;
}

interface GroupProductsArgs {
  readonly groupId: string;
  readonly products: readonly AdminProductView[];
}

function useGroupProductMutations(groupId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const attachMut = useMutation(
    trpc.admin.attachProductToGroup.mutationOptions({
      onSuccess: async () => {
        // Reassign invalidates every listGroupProducts query (old group too).
        await Promise.all([
          qc.invalidateQueries(trpc.admin.listGroupProducts.pathFilter()),
          invalidateGroupProductOwnership(qc, trpc),
        ]);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const detachMut = useMutation(
    trpc.admin.detachProductFromGroup.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: trpc.admin.listGroupProducts.queryKey({ groupId }),
          }),
          invalidateGroupProductOwnership(qc, trpc),
        ]);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  return {
    attach: attachMut.mutate,
    detach: detachMut.mutate,
    mutating: attachMut.isPending || detachMut.isPending,
  };
}

// Single batched ownership read for every active product, replacing the
// per-product listProductGroups fan-out (shared by the Groups and Products tabs). Skipped when there are no active
// products (the empty-list branch renders instead).
export function useProductOwnership(
  activeProducts: readonly AdminProductView[],
) {
  const trpc = useTRPC();

  const productIds = useMemo(
    () => activeProducts.map((product) => product.id),
    [activeProducts],
  );

  const ownershipQuery = useQuery({
    ...trpc.admin.listProductGroupOwnership.queryOptions({ productIds }),
    enabled: productIds.length > 0,
  });

  const owningGroupByProductId = useMemo(
    () =>
      new Map(
        (ownershipQuery.data ?? []).flatMap((entry) =>
          entry.group ? [[entry.productId, entry.group] as const] : [],
        ),
      ),
    [ownershipQuery.data],
  );

  return {
    owningGroupByProductId,
    ownershipLoading: ownershipQuery.isLoading,
    ownershipError: ownershipQuery.isError,
  };
}

export function useGroupProducts({ groupId, products }: GroupProductsArgs) {
  const trpc = useTRPC();

  const attachedQuery = useQuery(
    trpc.admin.listGroupProducts.queryOptions({ groupId }),
  );

  const attachedIds = useMemo(
    () => new Set((attachedQuery.data ?? []).map((row) => row.id)),
    [attachedQuery.data],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.status !== "archived"),
    [products],
  );

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.status !== "archived" || attachedIds.has(product.id),
      ),
    [attachedIds, products],
  );

  const { owningGroupByProductId, ownershipLoading, ownershipError } =
    useProductOwnership(activeProducts);
  const { attach, detach, mutating } = useGroupProductMutations(groupId);

  function toggle(productId: string, nextChecked: boolean): void {
    if (attachedQuery.isError) {
      return;
    }

    const owner = owningGroupByProductId.get(productId);
    if (nextChecked && owner && owner.id !== groupId) {
      toast.error(`Already attached to ${owner.name}`);
      return;
    }

    if (nextChecked) {
      attach({ groupId, productId });
    } else {
      detach({ groupId, productId });
    }
  }

  return {
    attachedLoading: attachedQuery.isLoading,
    attachedError: attachedQuery.isError,
    visibleProducts,
    attachedIds,
    owningGroupByProductId,
    ownershipLoading,
    ownershipError,
    mutating,
    toggle,
  };
}
