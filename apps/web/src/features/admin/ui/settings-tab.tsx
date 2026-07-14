"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { ComingSoonTooltip } from "@customreport/ui/components/ui/tooltip";

import type { MockSettings } from "../../../shared/lib/admin-mock-data";
import {
  IdentitySubTab,
  IntegrationsSubTab,
  NotificationsSubTab,
} from "../../organization";
import { PeriodsSubTab } from "../../period";
import { RemindersSubTab } from "./settings-reminders-sub-tab";
import { TabHeader } from "./tab-header";

interface SettingsTabProps {
  readonly settings: MockSettings;
}

/**
 * Settings tab laid out as a set of sub-tabs.
 *
 * Tab order is intentional:
 *   1. Identity     — Organization singleton (the only source of truth for
 *                     brand strings).
 *   2. Periods      — autoCreatePeriods, defaultDeadlineDays, plus the
 *                     period-cycle knobs.
 *   3. Reminders    — defaultTimezone, defaultReminderAudience.
 *   4. Notifications — notificationFromEmail.
 *
 * The five sub-tabs and the shared mutation/CheckIcon helpers live in sibling
 * modules (settings-*-sub-tab / settings-periods-fields-* / settings-tab-shared).
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
          {/* external-integrations badges. Surfaces Element (roadmapped
              messaging, Coming-Soon label) and AI (Coming-Soon). */}
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
          <div className="max-w-lg space-y-5">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Holiday calendar management coming soon. Schedule
              organization-wide closures to exclude from deadline calculations
              and report period boundaries.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Holidays Coming Soon Control ────────────────────────────────────────

function HolidaysComingSoonControl() {
  // TODO(holidays-activation): replace with real holidays calendar form when
  // the dedicated holiday-management phase ships.
  // The trigger matches the sibling tabs' plain-text underline style so no
  // sub-tab trigger stands out. The nested label stays inert (rendered as
  // a <span>, not a <button>, since the holidays TabsTrigger is itself a
  // <button> and a nested <button> would be invalid HTML / hydration error),
  // while the surrounding TabsTrigger remains selectable like its siblings.
  return (
    <ComingSoonTooltip>
      <span
        aria-disabled="true"
        data-testid="holidays-coming-soon"
        className="inline-flex cursor-default items-center"
      >
        Holidays
        {/* The Radix tooltip badge is portaled and only mounts on hover, so a
            PERSISTENT visually-hidden ComingSoonBadge keeps the coming-soon
            state in the holidays tab's accessible name (a descendant
            ComingSoonBadge text, no aria-label on the inert span). */}
        <ComingSoonBadge className="sr-only" />
      </span>
    </ComingSoonTooltip>
  );
}
