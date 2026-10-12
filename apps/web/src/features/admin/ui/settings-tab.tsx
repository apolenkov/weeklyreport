"use client";
import type { AppSettings } from "@customreport/shared";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { getScalarSearchParam } from "../../../shared/lib/navigation/scalar-search-param";
import { TabHeader } from "../../../shared/ui/tabs/tab-header";
import { IdentitySubTab, NotificationsSubTab } from "../../organization";
import { PeriodsSubTab } from "../../period";
import { RemindersSubTab } from "./reminders/settings-reminders-sub-tab";

const SETTINGS_SECTIONS = [
  { label: "Identity", value: "identity" },
  { label: "Periods", value: "periods" },
  { label: "Reminders", value: "reminders" },
  { label: "Notifications", value: "notifications" },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["value"];

interface SettingsSelection {
  readonly section: SettingsSection;
  readonly source: string;
}

function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section.value === value);
}

function sectionFromSearch(source: string): SettingsSection {
  const value = getScalarSearchParam(
    new URLSearchParams(source),
    "settingsTab",
  );
  return value !== null && isSettingsSection(value) ? value : "identity";
}

interface SettingsTabProps {
  readonly settings: AppSettings;
}

interface SettingsNavigationProps {
  readonly activeSection: SettingsSection;
  readonly onActivate: (value: string) => void;
}

function SettingsNavigation({
  activeSection,
  onActivate,
}: SettingsNavigationProps) {
  return (
    <>
      <select
        aria-label="Settings section"
        className="block h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 md:hidden"
        value={activeSection}
        onChange={(event) => onActivate(event.currentTarget.value)}
      >
        {SETTINGS_SECTIONS.map((section) => (
          <option key={section.value} value={section.value}>
            {section.label}
          </option>
        ))}
      </select>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
        <TabsList
          variant="line"
          className="min-w-max justify-start border-b border-[var(--color-border)]"
        >
          {SETTINGS_SECTIONS.map((section) => (
            <TabsTrigger key={section.value} value={section.value}>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </>
  );
}

export function SettingsTab({ settings: serverSettings }: SettingsTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchState = searchParams.toString();
  const [optimisticSelection, setOptimisticSelection] =
    useState<SettingsSelection>(() => ({
      section: sectionFromSearch(searchState),
      source: searchState,
    }));
  const urlSection = sectionFromSearch(searchState);
  if (optimisticSelection.source !== searchState) {
    setOptimisticSelection({ section: urlSection, source: searchState });
  }
  const activeSection =
    optimisticSelection.source === searchState
      ? optimisticSelection.section
      : urlSection;
  const activateSection = (value: string) => {
    if (!isSettingsSection(value)) return;
    setOptimisticSelection({ section: value, source: searchState });
    const params = new URLSearchParams(searchState);
    params.set("settingsTab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <TabHeader
        title="Settings"
        description="Organization identity, reporting defaults, reminders, and notifications."
      />

      <Tabs
        value={activeSection}
        onValueChange={activateSection}
        className="w-full"
      >
        <SettingsNavigation
          activeSection={activeSection}
          onActivate={activateSection}
        />

        <TabsContent value="identity" className="pt-6">
          <IdentitySubTab />
        </TabsContent>

        <TabsContent value="periods" className="pt-6">
          <PeriodsSubTab serverSettings={serverSettings} />
        </TabsContent>

        <TabsContent value="reminders" className="pt-6">
          <RemindersSubTab serverSettings={serverSettings} />
        </TabsContent>

        <TabsContent value="notifications" className="pt-6">
          <NotificationsSubTab serverSettings={serverSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
