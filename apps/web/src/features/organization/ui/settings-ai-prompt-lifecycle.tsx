import type {
  AiFeatureKey,
  AiPromptBundleRead,
  AiPromptContents,
} from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { PromptActions } from "./settings-ai-prompt-actions";

type PromptLifecycleProps = Readonly<{
  featureKey: AiFeatureKey;
  selected: AiPromptBundleRead;
  base: AiPromptBundleRead | null;
  selectedInstructions: AiPromptContents;
  dirty: boolean;
  active: AiPromptBundleRead | null;
  onSelectionChange: (bundle: AiPromptBundleRead | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => Promise<unknown>;
  children: (busy: boolean) => ReactNode;
}>;

const isCurrentServing = (bundle: AiPromptBundleRead): boolean =>
  bundle.servingStatus === "current";

const isDisposable = (bundle: AiPromptBundleRead): boolean =>
  bundle.lifecycle === "draft" || bundle.lifecycle === "failed";

const canDraftRevision = (
  base: AiPromptBundleRead | null,
  selected: AiPromptBundleRead,
  busy: boolean,
): boolean => Boolean(base) && isCurrentServing(selected) && !busy;

const canActivateRevision = (
  selected: AiPromptBundleRead,
  busy: boolean,
  dirty: boolean,
): boolean =>
  ["draft", "failed", "validated"].includes(selected.lifecycle) &&
  isCurrentServing(selected) &&
  !busy &&
  !dirty;

const canRestoreRevision = (
  selected: AiPromptBundleRead,
  busy: boolean,
  dirty: boolean,
): boolean =>
  selected.lifecycle === "superseded" &&
  isCurrentServing(selected) &&
  !busy &&
  !dirty;

const canDiscardRevision = (selected: AiPromptBundleRead): boolean =>
  isDisposable(selected) && isCurrentServing(selected);

function usePromptLifecycleMutations({
  active,
  onSelectionChange,
  onDirtyChange,
  onRefresh,
}: Readonly<{
  active: AiPromptBundleRead | null;
  onSelectionChange: (bundle: AiPromptBundleRead | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => Promise<unknown>;
}>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refreshQueries = useCallback(async () => {
    await onRefresh();
    void queryClient.invalidateQueries(trpc.admin.aiPrompts.list.pathFilter());
  }, [onRefresh, queryClient, trpc]);
  const draft = useMutation(
    trpc.admin.aiPrompts.draft.mutationOptions({
      onSuccess: (bundle) => {
        onSelectionChange(bundle);
        onDirtyChange(false);
        void refreshQueries();
        toast.success("AI prompt draft saved");
      },
      onError: () => toast.error("AI prompt draft could not be saved."),
    }),
  );
  const activate = useMutation(
    trpc.admin.aiPrompts.activate.mutationOptions({
      onSuccess: () => {
        onDirtyChange(false);
        void refreshQueries();
        toast.success("AI prompt version activated");
      },
      onError: () =>
        toast.error("AI prompt activation is stale or unavailable."),
    }),
  );
  const restore = useMutation(
    trpc.admin.aiPrompts.restore.mutationOptions({
      onSuccess: () => {
        onDirtyChange(false);
        void refreshQueries();
        toast.success("AI prompt version restored");
      },
      onError: () => toast.error("AI prompt restore is stale or unavailable."),
    }),
  );
  const discard = useMutation(
    trpc.admin.aiPrompts.discard.mutationOptions({
      onSuccess: () => {
        onSelectionChange(active);
        onDirtyChange(false);
        void refreshQueries();
        toast.success("AI prompt attempt discarded");
      },
      onError: () => toast.error("AI prompt attempt could not be discarded."),
    }),
  );
  return { draft, activate, restore, discard };
}

export function SettingsAiPromptLifecycle({
  featureKey,
  selected,
  base,
  selectedInstructions,
  dirty,
  active,
  onSelectionChange,
  onDirtyChange,
  onRefresh,
  children,
}: PromptLifecycleProps) {
  const { draft, activate, restore, discard } = usePromptLifecycleMutations({
    active,
    onSelectionChange,
    onDirtyChange,
    onRefresh,
  });
  const busy =
    draft.isPending ||
    activate.isPending ||
    restore.isPending ||
    discard.isPending;
  const canDraft = canDraftRevision(base, selected, busy);
  const canActivate = canActivateRevision(selected, busy, dirty);
  const canRestore = canRestoreRevision(selected, busy, dirty);
  const canDiscard = canDiscardRevision(selected);

  return (
    <>
      {children(busy)}
      <PromptActions
        busy={busy}
        canDraft={canDraft}
        canActivate={canActivate}
        canRestore={canRestore}
        canDiscard={canDiscard}
        draftPending={draft.isPending}
        activatePending={activate.isPending}
        restorePending={restore.isPending}
        discardPending={discard.isPending}
        dirty={dirty}
        onDraft={() =>
          base &&
          draft.mutate({
            featureKey,
            baseRevisionId: base.id,
            promptContents: selectedInstructions,
          })
        }
        onActivate={() =>
          activate.mutate({ featureKey, revisionId: selected.id })
        }
        onRestore={() =>
          restore.mutate({ featureKey, revisionId: selected.id })
        }
        onDiscard={() =>
          discard.mutate({ featureKey, revisionId: selected.id })
        }
      />
    </>
  );
}
