import type { AiProviderConfigurationRead } from "@customreport/shared";
import { Pencil } from "lucide-react";

import { profileLabel } from "./ai-provider-form";

export const lifecycleCopy: Record<
  AiProviderConfigurationRead["lifecycle"] | "none",
  { label: string; detail: string; next: string }
> = {
  none: {
    label: "Not configured",
    detail: "No provider is connected yet.",
    next: "Configure a provider to begin.",
  },
  draft: {
    label: "Draft",
    detail: "A saved configuration is waiting for a capability test.",
    next: "Test capabilities before activation.",
  },
  validated: {
    label: "Ready to activate",
    detail: "Both required capability checks passed.",
    next: "Activate this tested configuration.",
  },
  preparing: {
    label: "Preparing",
    detail: "Embedding preparation is in progress.",
    next: "Resume activation when preparation is ready.",
  },
  active: {
    label: "Active",
    detail: "This provider is available to report AI.",
    next: "Edit configuration to create a new draft.",
  },
  failed: {
    label: "Failed",
    detail: "The last capability test did not pass.",
    next: "Review the error and save a corrected draft.",
  },
  superseded: {
    label: "Retained",
    detail: "A retained configuration is available.",
    next: "Restore it or configure a new draft.",
  },
};

export function AiProviderStateSummary({
  lifecycle,
  revision,
  onEdit,
  onDisable,
  disablePending,
  showActiveActions,
}: Readonly<{
  lifecycle: AiProviderConfigurationRead["lifecycle"] | "none";
  revision: AiProviderConfigurationRead | null;
  onEdit: () => void;
  onDisable: () => void;
  disablePending: boolean;
  showActiveActions: boolean;
}>) {
  const state = lifecycleCopy[lifecycle];
  const active = lifecycle === "active" && revision;
  return (
    <>
      <section
        className="mb-5 border-b border-[var(--color-border)] pb-5"
        aria-labelledby="ai-provider-state-heading"
        data-testid="ai-provider-state-summary"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3
              id="ai-provider-state-heading"
              className="text-base font-semibold text-[var(--color-foreground)]"
            >
              Current provider status
            </h3>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {state.detail}
            </p>
          </div>
          <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-sm font-semibold text-[var(--color-foreground)]">
            {state.label}
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--color-foreground)]">
          Next: {state.next}
        </p>
        <ol
          className="mt-4 grid gap-2 text-sm sm:grid-cols-3"
          aria-label="AI provider setup workflow"
        >
          {[
            {
              label: "Configure",
              detail: lifecycle === "none" ? "Required" : "Saved",
            },
            {
              label: "Test capabilities",
              detail:
                lifecycle === "draft" || lifecycle === "failed"
                  ? "Required before activation"
                  : lifecycle === "none"
                    ? "Save a draft first"
                    : "Completed or in progress",
            },
            {
              label: "Activate",
              detail:
                lifecycle === "validated" || lifecycle === "preparing"
                  ? "Available"
                  : lifecycle === "active"
                    ? "Already active"
                    : "Locked until testing passes",
            },
          ].map(({ label, detail }, index) => (
            <li
              key={label}
              className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-muted-foreground)]"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-foreground)]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[var(--color-foreground)]">
                  {label}
                </span>
                <span className="block text-xs">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      {active && (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)]/60 p-4"
          data-testid="ai-provider-active-summary"
        >
          <div className="min-w-0 text-sm text-[var(--color-muted-foreground)]">
            <p className="font-semibold text-[var(--color-foreground)]">
              {profileLabel(revision.generation.profile)}
            </p>
            <p className="mt-1 break-words">
              Generation: {revision.generation.answerModel} · Embeddings:{" "}
              {revision.embeddings.model}
            </p>
            <p className="mt-1">
              Credentials are saved securely and remain masked.
            </p>
          </div>
          {showActiveActions && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                onClick={onEdit}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit configuration
              </button>
              <button
                type="button"
                className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onDisable}
                disabled={disablePending}
              >
                Disable
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
