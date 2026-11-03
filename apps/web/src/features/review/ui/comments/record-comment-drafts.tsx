"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import type { RecordCommentAnchor } from "./use-record-comment-state";

function createCommentDraftStore() {
  const drafts = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    read: (key: string) => drafts.get(key) ?? "",
    write: (key: string, value: string) => {
      if (value === "") drafts.delete(key);
      else drafts.set(key, value);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface CommentDraftScope {
  readonly reportId: string;
  readonly store: ReturnType<typeof createCommentDraftStore>;
}

const CommentDraftContext = createContext<CommentDraftScope | null>(null);

// The report owns drafts above mode, filter and scope-dependent record trees.
// Nothing is persisted globally or across page sessions.
export function RecordCommentDraftProvider({
  reportId,
  children,
}: {
  readonly reportId: string;
  readonly children: ReactNode;
}) {
  const [store] = useState(createCommentDraftStore);
  return (
    <CommentDraftContext key={reportId} value={{ reportId, store }}>
      {children}
    </CommentDraftContext>
  );
}

export function useRecordCommentDraft(
  anchor: RecordCommentAnchor,
  currentUserId: string,
) {
  const scope = useContext(CommentDraftContext);
  // A standalone thread owns its store; report threads share the page owner.
  const [localStore] = useState(createCommentDraftStore);
  const store = scope?.store ?? localStore;
  const key = JSON.stringify([
    scope?.reportId,
    currentUserId,
    anchor.itemId,
    anchor.riskId,
    anchor.decisionId,
  ]);
  const draft = useSyncExternalStore(
    store.subscribe,
    () => store.read(key),
    () => "",
  );
  return { draft, setDraft: (value: string) => store.write(key, value) };
}
