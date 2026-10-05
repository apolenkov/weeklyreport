"use client";

import {
  AI_PROMPT_FEATURE_KEYS,
  type AiFeatureKey,
  type AiPromptCatalogRead,
  type AiPromptFeatureRead,
  type AiProviderControlRead,
} from "@customreport/shared";
import { Tabs, TabsContent } from "@customreport/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  copyScalarSearchParams,
  getScalarSearchParam,
} from "../../../shared/lib/navigation/scalar-search-param";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { AiProviderCard } from "./ai-provider-card";
import { AiRuntimeFailureNotice } from "./ai-runtime-failure-notice";
import { AiTabsList, ReadinessSummary, RetryAlert } from "./ai-tab-sections";
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
    tab: tabFromSearch(getScalarSearchParam(params, "aiTab")),
    feature: featureKeyFromSearch(getScalarSearchParam(params, "aiFeature")),
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
        ? provider.runtimeFailure
          ? "Failing"
          : "Ready"
        : "Setup required",
    features: `${readyFeatures}/${features.length} ready`,
  };
}

function useAiSettingsSelection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchState = searchParams.toString();
  const [optimisticSelection, setOptimisticSelection] =
    useState<AiSettingsSelection>(() => selectionFromSearch(searchState));
  const urlSelection = selectionFromSearch(searchState);
  if (optimisticSelection.source !== searchState) {
    setOptimisticSelection(urlSelection);
  }
  const selection =
    optimisticSelection.source === searchState
      ? optimisticSelection
      : urlSelection;
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
    const params = copyScalarSearchParams(searchParams, ["aiTab", "aiFeature"]);
    if (values.tab) params.set("aiTab", values.tab);
    if (values.feature) params.set("aiFeature", values.feature);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  return { featureKey, activeTab, setAiState };
}

type FeatureQuery = Readonly<{
  data: AiPromptFeatureRead | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}>;

function FeaturesPanel({
  features,
  selectedKey,
  featureQ,
  onSelect,
  onRefresh,
}: Readonly<{
  features: AiPromptCatalogRead["features"];
  selectedKey: AiFeatureKey | null;
  featureQ: FeatureQuery;
  onSelect: (featureKey: AiFeatureKey) => void;
  onRefresh: () => Promise<unknown>;
}>) {
  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Registered AI features"
      >
        {features.map((feature) => (
          <button
            key={feature.featureKey}
            type="button"
            aria-pressed={selectedKey === feature.featureKey}
            className={`btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] ${selectedKey === feature.featureKey ? "border-[var(--color-starbucks-accent)] bg-[var(--color-surface-hover)] text-[var(--color-foreground)]" : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"}`}
            onClick={() => {
              onSelect(feature.featureKey);
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
        <RetryAlert
          message="Feature controls could not be loaded."
          isFetching={featureQ.isFetching}
          onRetry={() => void featureQ.refetch()}
        />
      )}
      {featureQ.data &&
        selectedKey !== null &&
        sameFeatureKey(featureQ.data.featureKey, selectedKey) && (
          <SettingsAiFeatureDetail
            feature={featureQ.data}
            onRefresh={onRefresh}
          />
        )}
    </>
  );
}

export function AiTab() {
  const trpc = useTRPC();
  const { featureKey, activeTab, setAiState } = useAiSettingsSelection();
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
  const refreshProviderDependents = async () => {
    const refreshes: Promise<unknown>[] = [catalogQ.refetch()];
    if (selectedKey !== null) refreshes.push(featureQ.refetch());
    await Promise.all(refreshes);
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
        <ReadinessSummary readiness={readiness} />
      </div>

      <AiRuntimeFailureNotice provider={providerQ.data} />

      {catalogQ.isError && (
        <RetryAlert
          message="AI feature catalog could not be loaded."
          isFetching={catalogQ.isFetching}
          onRetry={() => {
            void catalogQ.refetch();
          }}
        />
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          if (isAiSettingsTab(tab)) setAiState({ tab });
        }}
        className="w-full"
      >
        <AiTabsList />

        <TabsContent value="provider" className="pt-6">
          <AiProviderCard onRefreshDependents={refreshProviderDependents} />
        </TabsContent>

        <TabsContent value="features" className="space-y-5 pt-6">
          <FeaturesPanel
            features={catalogQ.data?.features ?? []}
            selectedKey={selectedKey}
            featureQ={featureQ}
            onSelect={(feature) =>
              setAiState({ tab: "features", feature: feature })
            }
            onRefresh={refreshFeature}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
