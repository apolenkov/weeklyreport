"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { ComingSoonTooltip } from "@customreport/ui/components/ui/tooltip";

import { TabHeader } from "../../../shared/ui/tab-header";
import {
  IdentitySubTab,
  IntegrationsSubTab,
  NotificationsSubTab,
} from "../../organization";
import { PeriodsSubTab } from "../../period";
import type { MockSettings } from "../model/admin-types";
import { RemindersSubTab } from "./settings-reminders-sub-tab";

interface SettingsTabProps {
  readonly settings: MockSettings;
}

/**
 * Settings Tab.
 * @param props - The props argument.
 */
export function SettingsTab({ settings: serverSettings }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader
        title="Settings"
        description="Organization identity, period defaults, and notification preferences."
      />

      <Tabs defaultValue="identity" className="w-full">
        <TabsList
          variant="line"
          className="max-w-full justify-start overflow-x-auto border-b border-[var(--color-border)]"
        >
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="holidays">
            <HolidaysComingSoonControl />
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="holidays" className="pt-6">
          <HolidaysComingSoonPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Holidays Coming Soon Control ────────────────────────────────────────

function HolidaysComingSoonPanel() {
  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Holiday calendar management coming soon. Schedule organization-wide
        closures to exclude from deadline calculations and report period
        boundaries.
      </p>
    </div>
  );
}

function HolidaysComingSoonControl() {
  // Nested label is a <span> (not <button>): TabsTrigger is already a button;
  // nesting would be invalid HTML / hydration error.
  return (
    <ComingSoonTooltip>
      <span
        aria-disabled="true"
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
