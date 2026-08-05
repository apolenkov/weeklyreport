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

import { TabHeader } from "../../../shared/ui/tabs/tab-header";
import {
  IdentitySubTab,
  IntegrationsSubTab,
  NotificationsSubTab,
} from "../../organization";
import { PeriodsSubTab } from "../../period";
import { RemindersSubTab } from "./settings-reminders-sub-tab";

interface SettingsTabProps {
  readonly settings: AppSettings;
}

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
          <TabsTrigger value="holidays" disabled>
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
      </Tabs>
    </div>
  );
}

// ─── Holidays Coming Soon Control ────────────────────────────────────────

function HolidaysComingSoonControl() {
  // The trigger itself is disabled (inert tab); the label span must not
  // duplicate the disabled state on a different element than the control.
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
