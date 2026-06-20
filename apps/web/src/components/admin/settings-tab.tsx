"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@customreport/ui/components/ui/tabs";
import { Calendar } from "lucide-react";

import { COMING_SOON_TOOLTIP_ANCHOR } from "../coming-soon-tooltip-anchor";
import type { MockSettings } from "./mock-data";
import { IdentitySubTab } from "./settings-identity-sub-tab";
import { IntegrationsSubTab } from "./settings-integrations-sub-tab";
import { NotificationsSubTab } from "./settings-notifications-sub-tab";
import { PeriodsSubTab } from "./settings-periods-sub-tab";
import { RemindersSubTab } from "./settings-reminders-sub-tab";
import { TabHeader } from "./tab-header";

interface SettingsTabProps {
  readonly settings: MockSettings;
}

/**
 * UFB-047 / Phase 48-A + 49-01: Settings tab restructured into a tabbed layout.
 *
 * Tab order is intentional:
 *   1. Identity     — Organization singleton (the only source of truth for
 *                     brand strings as of Phase 49-01).
 *   2. Periods      — autoCreatePeriods, defaultDeadlineDays, plus the
 *                     UFB-048 period-cycle knobs.
 *   3. Reminders    — defaultTimezone, defaultReminderAudience.
 *   4. Notifications — notificationFromEmail.
 *
 * The five sub-tabs and the shared mutation/CheckIcon helpers live in sibling
 * modules (settings-*-sub-tab / settings-periods-fields-* / settings-tab-shared)
 * extracted in the R3a-4 max-lines split. Phase 49-01 dropped the legacy
 * `AppSettings.departmentName` field and its Periods-tab deprecation banner.
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
          {/* UFB-056 / Phase 55-5: external-integrations badges. v1 only
              surfaces Telegram (seeds-only); future integrations (Slack,
              MS Teams, webhook fan-out) join the same sub-tab. */}
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
  // Rendered as a <span>, not a <button>: this control is inert and lives inside
  // the holidays TabsTrigger (itself a <button>), so a nested <button> would be
  // invalid HTML and trigger a React hydration error.
  return (
    <div className="group relative inline-flex">
      <span
        aria-disabled="true"
        data-testid="holidays-coming-soon"
        className="inline-flex h-8 w-10 cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] xl:w-[92px] xl:px-2.5"
      >
        <Calendar size={14} strokeWidth={2} aria-hidden="true" />
        <span className="hidden xl:inline">Holidays</span>
      </span>
      <ComingSoonBadge role="tooltip" className={COMING_SOON_TOOLTIP_ANCHOR} />
    </div>
  );
}
