import type {
  AiFeatureKey,
  AiPromptBundleRead,
  AiPromptContents,
  AiProviderConfigurationRead,
} from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { PromptActions } from "./settings-ai-prompt-actions";

type PromptLifecycleProps = Readonly<{
  featureKey: AiFeatureKey;
  selected: AiPromptBundleRead;
  base: AiPromptBundleRead | null;
  selectedInstructions: AiPromptContents;
  provider: AiProviderConfigurationRead | null;
  dirty: boolean;
  active: AiPromptBundleRead | null;
  onSelectionChange: (bundle: AiPromptBundleRead | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => Promise<unknown>;
  children: (busy: boolean) => ReactNode;
}>;

const POLL_INTERVAL_MS = 1500;

export const isCurrentProviderEvaluation = (
  bundle: AiPromptBundleRead | null,
  provider: AiProviderConfigurationRead | null,
): boolean =>
  bundle?.latestEvaluation?.outcome === "passed" &&
  bundle.latestEvaluation.generationCompatibilityIdentity ===
    provider?.generationCompatibilityIdentity &&
  bundle.latestEvaluation.contentHash === bundle.effectiveContentHash;

export function SettingsAiPromptLifecycle({
  featureKey,
  selected,
  base,
  selectedInstructions,
  provider,
  dirty,
  active,
  onSelectionChange,
  onDirtyChange,
  onRefresh,
  children,
}: PromptLifecycleProps) {
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
  const evaluate = useMutation(
    trpc.admin.aiPrompts.evaluate.mutationOptions({
      onSuccess: (bundle) => {
        onSelectionChange(bundle);
        onDirtyChange(false);
        void refreshQueries();
        toast.success("AI prompt evaluation queued");
      },
      onError: () =>
        toast.error("AI prompt evaluation could not be completed."),
    }),
  );

  const executionActive =
    selected.latestExecution?.state === "queued" ||
    selected.latestExecution?.state === "running";
  useEffect(() => {
    if (!executionActive) return undefined;
    const interval = window.setInterval(
      () => void refreshQueries(),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [executionActive, refreshQueries]);
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

  const evaluationId = selected.latestEvaluation?.id;
  const evaluatedForProvider = isCurrentProviderEvaluation(selected, provider);
  const busy =
    draft.isPending ||
    evaluate.isPending ||
    activate.isPending ||
    restore.isPending ||
    discard.isPending;
  const canDraft = Boolean(base && !busy);
  const canEvaluate =
    ["draft", "failed"].includes(selected.lifecycle) &&
    !busy &&
    !executionActive;
  const canActivate =
    selected.lifecycle === "validated" &&
    Boolean(evaluationId && evaluatedForProvider) &&
    !busy;
  const canRestore =
    selected.lifecycle === "superseded" &&
    Boolean(evaluationId && evaluatedForProvider) &&
    !busy;
  const canDiscard = ["draft", "failed"].includes(selected.lifecycle) && !busy;

  return (
    <>
      {children(busy)}
      <PromptActions
        busy={busy}
        canDraft={canDraft}
        canEvaluate={canEvaluate}
        canActivate={canActivate}
        canRestore={canRestore}
        canDiscard={canDiscard}
        draftPending={draft.isPending}
        evaluatePending={evaluate.isPending}
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
        onEvaluate={() =>
          evaluate.mutate({ featureKey, revisionId: selected.id })
        }
        onActivate={() =>
          activate.mutate({
            featureKey,
            revisionId: selected.id,
            evaluationId: evaluationId ?? "",
          })
        }
        onRestore={() =>
          restore.mutate({
            featureKey,
            revisionId: selected.id,
            evaluationId: evaluationId ?? "",
          })
        }
        onDiscard={() =>
          discard.mutate({ featureKey, revisionId: selected.id })
        }
      />
    </>
  );
}
