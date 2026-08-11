"use client";

import type { AiProviderConfigurationRead } from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";

const CAPABILITY_LABELS = {
  authentication: "Authentication",
  planner_tool_call: "Planner tool call",
  structured_answer: "Structured answer",
  token_usage: "Token usage",
  batch_embeddings: "Batch embeddings",
} as const;

const failureDescription = (failureCode: string | undefined): string => {
  if (failureCode === "OpenAiCompatibleProtocolError") {
    return "The provider response is incompatible.";
  }
  if (failureCode === "ReportAssistantProviderError") {
    return "The provider rejected the request or is temporarily unavailable.";
  }
  return "The capability check did not pass.";
};

export const capabilityTestMessage = (
  revision: AiProviderConfigurationRead,
): string => {
  if (revision.lifecycle === "validated") {
    return "All required provider capabilities passed.";
  }
  const failed =
    revision.testResult?.capabilities.filter(
      ({ status }) => status === "failed",
    ) ?? [];
  const actionable = failed.filter(
    ({ capability }) =>
      capability !== "authentication" ||
      !failed.some(({ capability: item }) => item === "planner_tool_call"),
  );
  const failure = actionable[0] ?? failed[0];
  if (!failure) return "The provider capability test failed.";
  return `${CAPABILITY_LABELS[failure.capability]}: ${failureDescription(
    failure.failureCode,
  )}`;
};

type AiProviderMutationsInput = Readonly<{
  trpc: ReturnType<typeof useTRPC>;
  refresh: () => void;
  setSavedRevision: Dispatch<
    SetStateAction<AiProviderConfigurationRead | null>
  >;
  setMessage: Dispatch<SetStateAction<string | null>>;
}>;

export const useAiProviderMutations = ({
  trpc,
  refresh,
  setSavedRevision,
  setMessage,
}: AiProviderMutationsInput) => {
  const save = useMutation(
    trpc.admin.aiProvider.save.mutationOptions({
      onSuccess: (revision) => {
        setSavedRevision(revision);
        setMessage("Draft saved. Test it before activation.");
        toast.success("AI provider draft saved");
      },
      onError: (error) => setMessage(error.message),
    }),
  );
  const test = useMutation(
    trpc.admin.aiProvider.test.mutationOptions({
      onSuccess: (revision) => {
        setSavedRevision(revision);
        setMessage(capabilityTestMessage(revision));
        toast.success(
          revision.lifecycle === "validated"
            ? "AI provider test passed"
            : "AI provider test completed",
        );
        refresh();
      },
      onError: (error) => setMessage(error.message),
    }),
  );
  const activate = useMutation(
    trpc.admin.aiProvider.activate.mutationOptions({
      onSuccess: () => {
        setSavedRevision(null);
        setMessage("Activation completed atomically.");
        refresh();
      },
      onError: (error) => setMessage(error.message),
    }),
  );
  const disable = useMutation(
    trpc.admin.aiProvider.disable.mutationOptions({
      onSuccess: () => {
        setMessage(
          "AI is disabled; the retained configuration was not deleted.",
        );
        refresh();
      },
      onError: (error) => setMessage(error.message),
    }),
  );
  const restore = useMutation(
    trpc.admin.aiProvider.restore.mutationOptions({
      onSuccess: () => {
        setMessage("The retained AI provider is being restored atomically.");
        refresh();
      },
      onError: (error) => setMessage(error.message),
    }),
  );

  return { save, test, activate, disable, restore };
};
