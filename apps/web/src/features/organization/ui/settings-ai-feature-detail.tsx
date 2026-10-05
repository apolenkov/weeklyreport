"use client";

import type {
  AiPromptBundleRead,
  AiPromptContents,
  AiPromptFeatureRead,
} from "@customreport/shared";
import { useEffect, useRef, useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { SettingsAiPromptLifecycle } from "./settings-ai-prompt-lifecycle";
import { PromptEditor, PromptHistory } from "./settings-ai-prompt-sections";

type FeatureDetailProps = Readonly<{
  feature: AiPromptFeatureRead;
  onRefresh: () => Promise<unknown>;
}>;

const lifecycleLabel = (lifecycle: AiPromptBundleRead["lifecycle"]): string =>
  lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);

function useFeaturePromptState(feature: AiPromptFeatureRead) {
  const source = feature.control.latestRevision ?? feature.control.activeBundle;
  const [selectedId, setSelectedId] = useState<string | null>(
    source?.id ?? null,
  );
  const [instructions, setInstructions] = useState<AiPromptContents | null>(
    source?.promptContents ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<AiPromptBundleRead | null>(null);
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
    feature.control.history.find(
      (bundle) =>
        bundle.servingStatus === "current" &&
        ["active", "validated", "superseded"].includes(bundle.lifecycle),
    ) ?? null;
  const selectedInstructions = instructions ?? selected?.promptContents ?? null;
  const selectVersionImmediately = (bundle: AiPromptBundleRead) => {
    setDirty(false);
    setSelectedId(bundle.id);
    setInstructions(bundle.promptContents);
  };
  const selectVersion = (bundle: AiPromptBundleRead) => {
    if (dirty) {
      setPendingSelection(bundle);
      return;
    }
    selectVersionImmediately(bundle);
  };
  const updateInstruction = (slot: keyof AiPromptContents, value: string) => {
    if (!selectedInstructions) return;
    setDirty(true);
    setInstructions((current) => ({
      ...(current ?? selectedInstructions),
      [slot]: value,
    }));
  };
  const handleLifecycleSelection = (bundle: AiPromptBundleRead | null) => {
    setSelectedId(bundle?.id ?? null);
    setInstructions(bundle?.promptContents ?? null);
  };
  return {
    updateInstruction,
    handleLifecycleSelection,
    dirty,
    setDirty,
    pendingSelection,
    setPendingSelection,
    selected,
    active,
    base,
    selectedInstructions,
    selectVersionImmediately,
    selectVersion,
  };
}

function FeatureDetailHeader({
  feature,
  selected,
}: Readonly<{
  feature: AiPromptFeatureRead;
  selected: AiPromptBundleRead;
}>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
          {feature.displayName}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {feature.description} The active editor version serves Report
          Assistant directly after structural validation. Runtime protocols,
          retrieval controls, and authorization remain owned by the application.
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
          {lifecycleLabel(selected.lifecycle)} · v{selected.revision}
        </span>
        <span
          className="text-xs font-semibold text-[var(--color-muted-foreground)]"
          data-testid="ai-prompt-serving-status"
        >
          {selected.servingStatus === "current"
            ? "Current serving contract"
            : "Incompatible serving snapshot"}
        </span>
      </div>
    </div>
  );
}

export function SettingsAiFeatureDetail({
  feature,
  onRefresh,
}: FeatureDetailProps) {
  const {
    dirty,
    setDirty,
    pendingSelection,
    setPendingSelection,
    selected,
    active,
    base,
    selectedInstructions,
    selectVersionImmediately,
    selectVersion,
    updateInstruction,
    handleLifecycleSelection,
  } = useFeaturePromptState(feature);

  if (!selectedInstructions || !selected) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        This registered feature has no active prompt baseline yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <FeatureDetailHeader feature={feature} selected={selected} />
      <SettingsAiPromptLifecycle
        featureKey={feature.featureKey}
        selected={selected}
        base={base}
        selectedInstructions={selectedInstructions}
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
      <ConfirmationDialog
        open={pendingSelection !== null}
        onClose={() => setPendingSelection(null)}
        onConfirm={() => {
          if (pendingSelection) selectVersionImmediately(pendingSelection);
          setPendingSelection(null);
        }}
        title="Discard unsaved prompt edits?"
        description="Switching versions will discard the edits in the current prompt draft."
        confirmLabel="Discard edits"
        variant="destructive"
      />
    </div>
  );
}
