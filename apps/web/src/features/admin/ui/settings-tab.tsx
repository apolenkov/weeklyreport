"use client";
import type { AppSettings } from "@customreport/shared";
import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { ComingSoonTooltip } from "@customreport/ui/components/coming-soon-tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { useState } from "react";

import { TabHeader } from "../../../shared/ui/tabs/tab-header";
import {
  IdentitySubTab,
  IntegrationsSubTab,
  NotificationsSubTab,
} from "../../organization";
import { PeriodsSubTab } from "../../period";
import { RemindersSubTab } from "./reminders/settings-reminders-sub-tab";

const SETTINGS_SECTIONS = [
  { label: "Identity", value: "identity" },
  { label: "Periods", value: "periods" },
  { label: "Reminders", value: "reminders" },
  { label: "Notifications", value: "notifications" },
  { label: "Integrations", value: "integrations" },
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
      <span
        aria-disabled="true"
        className="flex min-h-[var(--touch-target-min)] w-full items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-3 text-sm font-medium text-[var(--color-muted-foreground)] md:hidden"
        data-testid="mobile-holidays-coming-soon"
      >
        Holidays
        <ComingSoonBadge />
      </span>

      <TabsList
        variant="line"
        className="hidden max-w-full justify-start border-b border-[var(--color-border)] md:inline-flex"
      >
        <TabsTrigger value="identity">Identity</TabsTrigger>
        <TabsTrigger value="periods">Periods</TabsTrigger>
        <TabsTrigger value="reminders">Reminders</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger
          value="holidays"
          aria-disabled="true"
          className="cursor-default opacity-50"
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
            }
          }}
        >
          <HolidaysComingSoonControl />
        </TabsTrigger>
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

        <TabsContent value="integrations" className="pt-6">
          <IntegrationsSubTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Holidays Coming Soon Control ────────────────────────────────────────

function HolidaysComingSoonControl() {
  return (
    <ComingSoonTooltip>
      <span
        data-testid="holidays-coming-soon"
        className="inline-flex cursor-default items-center"
      >
        Holidays
        {/* Portaled hover badge vanishes; sr-only badge keeps coming-soon
            in the tab's accessible name without a title attribute. */}
        <ComingSoonBadge className="sr-only" />
      </span>
    </ComingSoonTooltip>
  );
}
