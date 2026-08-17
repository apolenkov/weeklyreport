"use client";

import type {
  AiFeatureKey,
  AiPromptCatalogRead,
  AiPromptFeatureRead,
  AiProviderControlRead,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { AiProviderCard } from "./ai-provider-card";
import { SettingsAiFeatureDetail } from "./settings-ai-feature-detail";

type AiSettingsSection = "overview" | "provider" | "features";

const sectionLabels: Readonly<Record<AiSettingsSection, string>> = {
  overview: "Overview",
  provider: "Provider",
  features: "Features",
};

const availabilityLabel = (
  value: AiPromptFeatureRead["control"]["availability"],
): string => {
  if (value === "available") return "Ready";
  if (value === "evaluation_required") return "Evaluation required";
  if (value === "provider_incompatible") return "Provider incompatible";
  return "Not configured";
};

function Overview({
  provider,
  catalog,
}: Readonly<{
  provider: AiProviderControlRead | undefined;
  catalog: AiPromptCatalogRead | undefined;
}>) {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
          AI overview
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Organization-wide AI readiness is derived from the active provider and
          the registered feature prompt controls. Credentials and prompt bodies
          stay out of this summary.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
            Provider
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
            {provider?.availability === "available"
              ? "Available"
              : "Not configured"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {provider?.active
              ? `${provider.active.generation.profile} · ${provider.active.generation.answerModel}`
              : "No active provider revision"}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
            Registered features
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
            {catalog?.features.length ?? 0}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Code-registered controls only
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {(catalog?.features ?? []).map((feature) => (
          <div
            key={feature.featureKey}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-[var(--color-foreground)]">
                  {feature.displayName}
                </h4>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  Active version{" "}
                  {feature.control.activeBundle
                    ? `v${feature.control.activeBundle.revision}`
                    : "not configured"}
                </p>
              </div>
              <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
                {availabilityLabel(feature.control.availability)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsAiSubTab() {
  const trpc = useTRPC();
  const [section, setSection] = useState<AiSettingsSection>("overview");
  const [featureKey, setFeatureKey] = useState<AiFeatureKey | null>(null);
  const providerQ = useQuery({
    ...trpc.admin.aiProvider.get.queryOptions(),
    enabled: true,
  });
  const catalogQ = useQuery({
    ...trpc.admin.aiPrompts.list.queryOptions(),
    enabled: section !== "provider",
  });
  const selectedKey =
    featureKey ?? catalogQ.data?.features[0]?.featureKey ?? null;
  const featureQ = useQuery({
    ...trpc.admin.aiPrompts.get.queryOptions({
      featureKey: selectedKey ?? "lead-report-assistant",
    }),
    enabled: section === "features" && selectedKey !== null,
  });

  const refreshFeature = async () => {
    await Promise.all([
      catalogQ.refetch(),
      providerQ.refetch(),
      featureQ.refetch(),
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          AI
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Manage the organization provider and registered AI feature behavior.
        </p>
      </div>
      <div
        className="flex max-w-full gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-2"
        role="tablist"
        aria-label="AI settings sections"
      >
        {(Object.keys(sectionLabels) as AiSettingsSection[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={section === item}
            className={`shrink-0 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold ${section === item ? "bg-[var(--color-starbucks-accent)] text-white" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)]"}`}
            onClick={() => setSection(item)}
          >
            {sectionLabels[item]}
          </button>
        ))}
      </div>

      {(providerQ.isError || catalogQ.isError) && (
        <p className="text-sm text-red-600" role="alert">
          AI settings could not be loaded.
        </p>
      )}
      {section === "overview" && (
        <Overview provider={providerQ.data} catalog={catalogQ.data} />
      )}
      {section === "provider" && <AiProviderCard />}
      {section === "features" && (
        <div className="space-y-5">
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Registered AI features"
          >
            {(catalogQ.data?.features ?? []).map((feature) => (
              <button
                key={feature.featureKey}
                type="button"
                aria-pressed={selectedKey === feature.featureKey}
                className={`rounded-[var(--radius-pill)] border px-3 py-2 text-sm font-semibold ${selectedKey === feature.featureKey ? "border-[var(--color-starbucks-accent)] bg-[var(--color-surface-hover)]" : "border-[var(--color-border)]"}`}
                onClick={() => setFeatureKey(feature.featureKey)}
              >
                {feature.displayName}
              </button>
            ))}
          </div>
          {featureQ.isLoading && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Loading feature controls…
            </p>
          )}
          {featureQ.isError && (
            <p className="text-sm text-red-600" role="alert">
              Feature controls could not be loaded.
            </p>
          )}
          {featureQ.data && (
            <SettingsAiFeatureDetail
              feature={featureQ.data}
              provider={providerQ.data?.active ?? null}
              onRefresh={refreshFeature}
            />
          )}
        </div>
      )}
    </div>
  );
}
