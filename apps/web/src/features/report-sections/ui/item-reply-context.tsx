"use client";

import { createContext, useContext } from "react";

import type { StatusOverviewItem } from "../model/status-overview";

/**
 * Result of one Lead reply attempt. "uncertain" means the request may have
 * reached the server, so the Lead checks the discussion before resending.
 */
export type ItemReplyOutcome = "sent" | "rejected" | "uncertain";

/** The page-owned discussion capability for the Lead's own editable items. */
export interface ItemReplyPort {
  /** The own live section whose item discussions may be read. */
  readonly reportSectionId: string | null;
  readonly send: (
    item: StatusOverviewItem,
    text: string,
  ) => Promise<ItemReplyOutcome>;
}

const ItemReplyContext = createContext<ItemReplyPort | null>(null);

export const ItemReplyProvider = ItemReplyContext.Provider;

export function useItemReplyPort(): ItemReplyPort | null {
  return useContext(ItemReplyContext);
}
