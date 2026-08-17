"use client";

import type {
  AiPromptBundleRead,
  AiPromptContents,
  AiPromptFeatureRead,
  AiProviderConfigurationRead,
} from "@customreport/shared";
import { useEffect, useRef, useState } from "react";

import {
  isCurrentProviderEvaluation,
  SettingsAiPromptLifecycle,
} from "./settings-ai-prompt-lifecycle";
import { PromptEditor, PromptHistory } from "./settings-ai-prompt-sections";

type FeatureDetailProps = Readonly<{
  feature: AiPromptFeatureRead;
  provider: AiProviderConfigurationRead | null;
  onRefresh: () => Promise<unknown>;
}>;

const lifecycleLabel = (lifecycle: AiPromptBundleRead["lifecycle"]): string =>
  lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);

export function SettingsAiFeatureDetail({
  feature,
  provider,
  onRefresh,
}: FeatureDetailProps) {
  const source = feature.control.latestRevision ?? feature.control.activeBundle;
  const [selectedId, setSelectedId] = useState<string | null>(
    source?.id ?? null,
  );
  const [instructions, setInstructions] = useState<AiPromptContents | null>(
    source?.promptContents ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const lastSeeded = useRef<AiPromptBundleRead | null>(source);
  useEffect(() => {
    if (source && !dirty && source !== lastSeeded.current) {
      lastSeeded.current = source;
      const retained =
        feature.control.history.find((bundle) => bundle.id === selectedId) ??
        source;
      setSelectedId(retained.id);
      setInstructions(retained.promptContents);
    }
  }, [dirty, feature.control.history, selectedId, source]);

  const selected =
    feature.control.history.find((bundle) => bundle.id === selectedId) ??
    feature.control.latestRevision ??
    feature.control.activeBundle;
  const active = feature.control.activeBundle;
  const base =
    active ??
    feature.control.history.find((bundle) =>
      ["validated", "superseded"].includes(bundle.lifecycle),
    ) ??
    null;
  const selectedInstructions = instructions ?? selected?.promptContents ?? null;
  const evaluatedForProvider = isCurrentProviderEvaluation(selected, provider);
  const compatibilityLabel = evaluatedForProvider
    ? "Passes current provider evaluation"
    : provider
      ? "Evaluation required for current provider"
      : "Provider unavailable";

  if (!selectedInstructions || !selected) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        This registered feature has no active prompt baseline yet.
      </p>
    );
  }

  const updateInstruction = (slot: keyof AiPromptContents, value: string) => {
    setDirty(true);
    setInstructions((current) => ({
      ...(current ?? selectedInstructions),
      [slot]: value,
    }));
  };
  const selectVersion = (bundle: AiPromptBundleRead) => {
    if (dirty && !window.confirm("Discard unsaved prompt edits?")) return;
    setDirty(false);
    setSelectedId(bundle.id);
    setInstructions(bundle.promptContents);
  };
  const handleLifecycleSelection = (bundle: AiPromptBundleRead | null) => {
    setSelectedId(bundle?.id ?? null);
    setInstructions(bundle?.promptContents ?? null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
            {feature.displayName}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            {feature.description} Runtime currently uses the versioned prompts
            shipped with the application. Stored editor revisions are retained
            for future use and do not affect provider activation or Chat.
          </p>
        </div>
        <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
          {lifecycleLabel(selected.lifecycle)} · v{selected.revision}
        </span>
      </div>
      <p
        className="text-sm text-[var(--color-muted-foreground)]"
        data-testid="ai-prompt-provider-compatibility"
      >
        Optional diagnostic: {compatibilityLabel}
      </p>

      <SettingsAiPromptLifecycle
        featureKey={feature.featureKey}
        selected={selected}
        base={base}
        selectedInstructions={selectedInstructions}
        provider={provider}
        dirty={dirty}
        active={active}
        onSelectionChange={handleLifecycleSelection}
        onDirtyChange={setDirty}
        onRefresh={onRefresh}
      >
        {(busy) => (
          <div className="max-w-4xl">
            <PromptEditor
              feature={feature}
              instructions={selectedInstructions}
              busy={busy}
              onChange={updateInstruction}
            />
          </div>
        )}
      </SettingsAiPromptLifecycle>

      <PromptHistory
        history={feature.control.history}
        active={active}
        selected={selected}
        dirty={dirty}
        onSelect={selectVersion}
      />
    </div>
  );
}
