"use client";

import {
  AI_PROMPT_FEATURE_KEYS,
  type AiFeatureKey,
  type AiPromptCatalogRead,
  type AiProviderControlRead,
} from "@customreport/shared";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { AiProviderCard } from "./ai-provider-card";
import { SettingsAiFeatureDetail } from "./settings-ai-feature-detail";

const sameFeatureKey = (left: unknown, right: unknown): boolean =>
  left === right;

type AiSettingsTab = "provider" | "features";

type AiSettingsSelection = Readonly<{
  source: string;
  tab: AiSettingsTab;
  feature: AiFeatureKey | null;
}>;

const featureKeyFromSearch = (value: string | null): AiFeatureKey | null =>
  AI_PROMPT_FEATURE_KEYS.find((featureKey) => featureKey === value) ?? null;

const tabFromSearch = (value: string | null): AiSettingsTab =>
  value === "features" ? "features" : "provider";

const selectionFromSearch = (source: string): AiSettingsSelection => {
  const params = new URLSearchParams(source);
  return {
    source,
    tab: tabFromSearch(params.get("aiTab")),
    feature: featureKeyFromSearch(params.get("aiFeature")),
  };
};

const isAiSettingsTab = (value: string): value is AiSettingsTab =>
  value === "provider" || value === "features";

function aiReadiness({
  provider,
  catalog,
  providerUnavailable,
}: Readonly<{
  provider: AiProviderControlRead | undefined;
  catalog: AiPromptCatalogRead | undefined;
  providerUnavailable: boolean;
}>): Readonly<{ provider: string; features: string }> {
  const features = catalog?.features ?? [];
  const readyFeatures = features.filter(
    (feature) => feature.control.availability === "available",
  ).length;
  const providerReady = provider?.availability === "available";

  return {
    provider: providerUnavailable
      ? "Unavailable"
      : providerReady
        ? "Ready"
        : "Setup required",
    features: `${readyFeatures}/${features.length} ready`,
  };
}

export function AiTab() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchState = searchParams.toString();
  const [optimisticSelection, setOptimisticSelection] =
    useState<AiSettingsSelection>(() => selectionFromSearch(searchState));
  const selection =
    optimisticSelection.source === searchState
      ? optimisticSelection
      : selectionFromSearch(searchState);
  const { feature: featureKey, tab: activeTab } = selection;

  const setAiState = (values: {
    tab?: AiSettingsTab;
    feature?: AiFeatureKey;
  }) => {
    setOptimisticSelection({
      source: searchState,
      tab: values.tab ?? activeTab,
      feature: values.feature ?? featureKey,
    });
    const params = new URLSearchParams(searchState);
    if (values.tab) params.set("aiTab", values.tab);
    if (values.feature) params.set("aiFeature", values.feature);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const providerQ = useQuery(trpc.admin.aiProvider.get.queryOptions());
  const catalogQ = useQuery(trpc.admin.aiPrompts.list.queryOptions());
  const selectedKey =
    featureKey ?? catalogQ.data?.features[0]?.featureKey ?? null;
  const featureQ = useQuery({
    ...trpc.admin.aiPrompts.get.queryOptions({
      featureKey: selectedKey ?? "lead-report-assistant",
    }),
    enabled: selectedKey !== null,
  });
  const readiness = aiReadiness({
    provider: providerQ.data,
    catalog: catalogQ.data,
    providerUnavailable: providerQ.isError,
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
          Configure a provider, test it, then enable report features.
        </p>
      </div>

      {catalogQ.isError && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-[var(--color-destructive)]">
            AI feature catalog could not be loaded.
          </p>
          <button
            type="button"
            className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
            onClick={() => {
              void catalogQ.refetch();
            }}
            disabled={catalogQ.isFetching}
          >
            {catalogQ.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          if (isAiSettingsTab(tab)) setAiState({ tab });
        }}
        className="w-full"
      >
        <div className="min-w-0 max-w-full overflow-x-auto">
          <TabsList
            variant="line"
            className="min-w-max justify-start border-b border-[var(--color-border)]"
          >
            <TabsTrigger value="provider" aria-label="Provider">
              <span>Provider</span>
              <span
                className="ml-2 text-xs font-medium text-[var(--color-muted-foreground)]"
                aria-live="polite"
              >
                {readiness.provider}
              </span>
            </TabsTrigger>
            <TabsTrigger value="features" aria-label="Features">
              <span>Features</span>
              <span
                className="ml-2 text-xs font-medium text-[var(--color-muted-foreground)]"
                aria-live="polite"
              >
                {readiness.features}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="provider" className="pt-6">
          <AiProviderCard />
        </TabsContent>

        <TabsContent value="features" className="space-y-5 pt-6">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Registered AI features"
          >
            {(catalogQ.data?.features ?? []).map((feature) => (
              <button
                key={feature.featureKey}
                type="button"
                aria-pressed={selectedKey === feature.featureKey}
                className={`btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] ${selectedKey === feature.featureKey ? "border-[var(--color-starbucks-accent)] bg-[var(--color-surface-hover)] text-[var(--color-foreground)]" : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"}`}
                onClick={() => {
                  setAiState({ tab: "features", feature: feature.featureKey });
                }}
              >
                {feature.displayName}
              </button>
            ))}
          </div>
          {featureQ.isPending && selectedKey !== null && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Loading feature controls…
            </p>
          )}
          {featureQ.isError && (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <p className="text-sm text-[var(--color-destructive)]">
                Feature controls could not be loaded.
              </p>
              <button
                type="button"
                className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                onClick={() => void featureQ.refetch()}
                disabled={featureQ.isFetching}
              >
                {featureQ.isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          )}
          {featureQ.data &&
            selectedKey !== null &&
            sameFeatureKey(featureQ.data.featureKey, selectedKey) && (
              <SettingsAiFeatureDetail
                feature={featureQ.data}
                onRefresh={refreshFeature}
              />
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
