"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import type { RecordCommentAnchor } from "./use-record-comment-state";

interface CommentSubmission {
  readonly draft: string;
}

interface CommentDraft {
  readonly text: string;
  readonly submission: CommentSubmission | null;
}

const EMPTY_DRAFT: CommentDraft = { text: "", submission: null };

function createCommentDraftStore() {
  const drafts = new Map<string, CommentDraft>();
  const listeners = new Set<() => void>();
  const read = (key: string) => drafts.get(key) ?? EMPTY_DRAFT;
  const write = (key: string, value: CommentDraft) => {
    if (value.text === "" && !value.submission) drafts.delete(key);
    else drafts.set(key, value);
    listeners.forEach((listener) => listener());
  };
  return {
    read,
    write: (key: string, text: string) => write(key, { ...read(key), text }),
    beginSubmission: (key: string) => {
      const current = read(key);
      if (current.submission) return null;
      const submission = { draft: current.text };
      write(key, { ...current, submission });
      return submission;
    },
    finishSubmission: (
      key: string,
      submission: CommentSubmission,
      success: boolean,
    ) => {
      const current = read(key);
      if (current.submission !== submission) return;
      const text =
        success && current.text === submission.draft ? "" : current.text;
      write(key, { text, submission: null });
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
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.read(key),
    () => EMPTY_DRAFT,
  );
  return {
    draft: state.text,
    isCommentPending: state.submission !== null,
    setDraft: (value: string) => store.write(key, value),
    beginSubmission: () => {
      const submission = store.beginSubmission(key);
      return submission
        ? (success: boolean) => store.finishSubmission(key, submission, success)
        : null;
    },
  };
}
