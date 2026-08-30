"use client";
import type { AppSettings } from "@customreport/shared";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { useState } from "react";

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

function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section.value === value);
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
      <TabsList
        variant="line"
        className="hidden max-w-full justify-start border-b border-[var(--color-border)] md:inline-flex"
      >
        <TabsTrigger value="identity">Identity</TabsTrigger>
        <TabsTrigger value="periods">Periods</TabsTrigger>
        <TabsTrigger value="reminders">Reminders</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
    </>
  );
}

export function SettingsTab({ settings: serverSettings }: SettingsTabProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("identity");
  const activateSection = (value: string) => {
    if (isSettingsSection(value)) setActiveSection(value);
  };

  return (
    <div className="space-y-6">
      <TabHeader
        title="Settings"
        description="Organization identity, period defaults, and notification preferences."
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
