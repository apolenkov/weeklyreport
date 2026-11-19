"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import {
  createItemDiscussionStore,
  type ItemDiscussionStore,
} from "./item-discussion-store";

/**
 * Result of one Lead reply attempt. "uncertain" means the request may have
 * reached the server, so the Lead checks the discussion before resending.
 */
export type ItemReplyOutcome = "sent" | "rejected" | "uncertain";

/** The page-owned discussion capability for the Lead's own live items. */
export interface ItemReplyPort {
  /** The own live section whose item discussions may be read. */
  readonly reportSectionId: string | null;
  readonly send: (
    item: StatusOverviewItem,
    text: string,
  ) => Promise<ItemReplyOutcome>;
}

interface ItemReplyScope {
  readonly port: ItemReplyPort;
  readonly store: ItemDiscussionStore;
}

const ItemReplyContext = createContext<ItemReplyScope | null>(null);

/**
 * Provides the reply port together with one discussion store that lives as
 * long as the page surface, so drafts and attempts survive closed cards.
 */
export function ItemReplyProvider({
  value,
  children,
}: {
  readonly value: ItemReplyPort | null;
  readonly children: ReactNode;
}) {
  const [store] = useState(createItemDiscussionStore);
  const scope = useMemo(
    () => (value === null ? null : { port: value, store }),
    [value, store],
  );
  return (
    <ItemReplyContext.Provider value={scope}>
      {children}
    </ItemReplyContext.Provider>
  );
}

export function useItemReplyScope(): ItemReplyScope | null {
  return useContext(ItemReplyContext);
}
