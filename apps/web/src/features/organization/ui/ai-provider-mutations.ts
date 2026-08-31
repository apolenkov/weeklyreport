"use client";

import type { AiProviderConfigurationRead } from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";

export const AI_PROVIDER_TEST_QUEUED_MESSAGE = "Provider test queued.";

const CAPABILITY_LABELS = {
  authentication: "Authentication",
  structured_planner: "Structured planner",
  planner_tool_call: "Planner tool call",
  structured_answer: "Structured answer",
  token_usage: "Token usage",
  batch_embeddings: "Batch embeddings",
} as const;

const failureDescription = (failureCode: string | undefined): string => {
  if (failureCode === "tool_use_failed") {
    return "The model did not produce a valid tool call after retry.";
  }
  if (
    failureCode === "rate_limit_exceeded" ||
    failureCode === "provider_http_429"
  ) {
    return "The provider rate limit was exceeded after retry.";
  }
  if (failureCode === "provider_authentication_failed") {
    return "The provider rejected the credential.";
  }
  if (failureCode === "OpenAiCompatibleProtocolError") {
    return "The provider response is incompatible.";
  }
  if (failureCode === "ReportAssistantProviderError") {
    return "The provider rejected the request or is temporarily unavailable.";
  }
  return "The capability check did not pass.";
};

type CapabilityTestResult = NonNullable<
  AiProviderConfigurationRead["testResult"]
>;
type CapabilityLane =
  CapabilityTestResult["generation"] | CapabilityTestResult["embeddings"];

const capabilityTestMessage = (
  revision: AiProviderConfigurationRead,
): string => {
  const result = revision.testResult;
  if (!result) return "The provider capability test failed.";
  if (result.status === "passed") {
    return "Generation, planner, answer, and embeddings passed.";
  }
  if (result.status === "inconclusive") {
    return revision.embeddings.mode === "reuse_generation"
      ? "Generation and Embeddings share one connection; the test was inconclusive. Retry when the provider is available."
      : "Generation or Embeddings was temporarily unavailable; retry the test.";
  }
  const laneMessage = (label: string, lane: CapabilityLane): string | null => {
    const failed = lane.capabilities.find(({ status }) => status === "failed");
    return failed
      ? `${label} · ${CAPABILITY_LABELS[failed.capability]}: ${failureDescription(failed.failureCode)}`
      : lane.status === "failed"
        ? `${label}: the connection did not pass its required checks.`
        : null;
  };
  const messages = [
    laneMessage("Generation", result.generation),
    ...(revision.embeddings.mode === "reuse_generation"
      ? []
      : [laneMessage("Embeddings", result.embeddings)]),
  ].filter((message): message is string => message !== null);
  return (
    messages[0] ??
    "The provider capability test did not produce a complete result."
  );
};

export const providerTestExecutionMessage = (
  revision: AiProviderConfigurationRead,
): string | null => {
  const execution = revision.latestExecution;
  if (!execution) return null;
  if (execution.state === "queued") {
    return AI_PROVIDER_TEST_QUEUED_MESSAGE;
  }
  if (execution.state === "running") {
    return "Provider test running.";
  }
  if (execution.outcome === "inconclusive") {
    return "The provider test could not be completed because the provider is temporarily unavailable. Retry the test.";
  }
  if (execution.outcome === "configuration_error") {
    return execution.failureCode === "provider_authentication_failed"
      ? "Generation authentication failed. Replace the rejected provider credential and save a new draft."
      : "The provider rejected its configuration. Review the endpoint and model identifiers.";
  }
  return capabilityTestMessage(revision);
};

type AiProviderMutationsInput = Readonly<{
  trpc: ReturnType<typeof useTRPC>;
  refresh: () => void;
  setSavedRevision: Dispatch<
    SetStateAction<AiProviderConfigurationRead | null>
  >;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setOperationFailed: Dispatch<SetStateAction<boolean>>;
}>;

export const useAiProviderMutations = ({
  trpc,
  refresh,
  setSavedRevision,
  setMessage,
  setOperationFailed,
}: AiProviderMutationsInput) => {
  const save = useMutation(
    trpc.admin.aiProvider.save.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: (revision) => {
        setSavedRevision(revision);
        setMessage("Draft saved. Test it before activation.");
        setOperationFailed(false);
        toast.success("AI provider draft saved");
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );
  const test = useMutation(
    trpc.admin.aiProvider.test.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: (revision) => {
        setSavedRevision(revision);
        setMessage(
          providerTestExecutionMessage(revision) ??
            capabilityTestMessage(revision),
        );
        setOperationFailed(false);
        toast.success("AI provider test queued");
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );
  const activate = useMutation(
    trpc.admin.aiProvider.activate.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: () => {
        setSavedRevision(null);
        setMessage("Activation completed atomically.");
        setOperationFailed(false);
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );
  const disable = useMutation(
    trpc.admin.aiProvider.disable.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: () => {
        setMessage(
          "AI is disabled; the retained configuration was not deleted.",
        );
        setOperationFailed(false);
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );
  const restore = useMutation(
    trpc.admin.aiProvider.restore.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: () => {
        setMessage("The retained AI provider is being restored atomically.");
        setOperationFailed(false);
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );
  const discard = useMutation(
    trpc.admin.aiProvider.discard.mutationOptions({
      onMutate: () => {
        setMessage(null);
        setOperationFailed(false);
      },
      onSuccess: () => {
        setSavedRevision(null);
        setMessage("Discarded AI provider attempt.");
        setOperationFailed(false);
        refresh();
      },
      onError: (error) => {
        setMessage(error.message);
        setOperationFailed(true);
      },
    }),
  );

  return { save, test, activate, disable, restore, discard };
};
