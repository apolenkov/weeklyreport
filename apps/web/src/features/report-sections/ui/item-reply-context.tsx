"use client";

import { createContext, useContext } from "react";

import type { StatusOverviewItem } from "../model/status-overview";

/**
 * Result of one Lead reply attempt. "uncertain" means the request may have
 * reached the server, so the Lead checks the discussion before resending.
 */
export type ItemReplyOutcome =
  "sent" | "rejected" | "uncertain" | "refresh-failed";

/** The page-owned reply capability for the Lead's own editable items. */
export interface ItemReplyPort {
  readonly send: (
    item: StatusOverviewItem,
    text: string,
  ) => Promise<ItemReplyOutcome>;
  /** Re-reads the authoritative discussion; resolves false on failure. */
  readonly refresh: () => Promise<boolean>;
}

const ItemReplyContext = createContext<ItemReplyPort | null>(null);

export const ItemReplyProvider = ItemReplyContext.Provider;

export function useItemReplyPort(): ItemReplyPort | null {
  return useContext(ItemReplyContext);
}
