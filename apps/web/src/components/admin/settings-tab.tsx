"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@customreport/ui/components/ui/tabs";

import { invalidateAdmin } from "../../lib/cache-keys";
import { useTRPC } from "../../lib/trpc-context";

import { TabHeader } from "./tab-header";
import { TIMEZONE_OPTIONS } from "./timezone-options";

import type { MockSettings } from "./mock-data";

type SettingsTabProps = {
  readonly settings: MockSettings;
};

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
 * Phase 49-01 dropped the legacy `AppSettings.departmentName` field and
 * the deprecation banner that flagged its retirement on the Periods tab.
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
          className="border-b border-[var(--color-border)]"
        >
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {/* UFB-056 / Phase 55-5: external-integrations badges. v1 only
              surfaces Telegram (seeds-only); future integrations (Slack,
              MS Teams, webhook fan-out) join the same sub-tab. */}
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
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

// ─── Identity sub-tab ────────────────────────────────────────────────────

function IdentitySubTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const orgQ = useQuery(trpc.admin.getOrganization.queryOptions());

  const [shortName, setShortName] = useState("");
  const [fullName, setFullName] = useState("");

  // Re-seed the form whenever the source query revalidates so a successful
  // save (which triggers invalidateAdmin) is reflected in the inputs.
  useEffect(() => {
    if (orgQ.data) {
      setShortName(orgQ.data.shortName);
      setFullName(orgQ.data.fullName);
    }
  }, [orgQ.data]);

  const updateOrgMut = useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: async () => {
        invalidateAdmin(qc, trpc);
        // A9: invalidate landing page cache after org name change
        await fetch('/api/revalidate-org', { method: 'POST' });
        toast.success("Organization identity saved");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to save organization identity");
      },
    }),
  );

  const isSaving = updateOrgMut.isPending;
  const isLoading = orgQ.isLoading;

  function handleSave() {
    updateOrgMut.mutate({
      shortName: shortName.trim(),
      fullName: fullName.trim(),
    });
  }

  const shortNameOver = shortName.length > 16;
  const fullNameOver = fullName.length > 200;
  const canSave =
    !isSaving &&
    !isLoading &&
    shortName.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !shortNameOver &&
    !fullNameOver;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        These values brand the application chrome: the nav-bar shows the short
        name, the landing page hero shows both, and PDF report headers use the
        full name.
      </p>

      <div>
        <label
          htmlFor="org-short-name"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Short name
        </label>
        <input
          id="org-short-name"
          name="org-short-name"
          type="text"
          autoComplete="off"
          maxLength={16}
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown in the nav-bar brand pill (max 16 chars).
          </span>
          <span
            className={
              shortNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {shortName.length}/16
          </span>
        </div>
      </div>

      <div>
        <label
          htmlFor="org-full-name"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Full name
        </label>
        <input
          id="org-full-name"
          name="org-full-name"
          type="text"
          autoComplete="off"
          maxLength={200}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted-foreground)]">
            Shown on the landing hero and in PDF report headers (max 200 chars).
          </span>
          <span
            className={
              fullNameOver
                ? "text-red-600"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {fullName.length}/200
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save organization identity"
        >
          {isSaving ? "Saving…" : "Save Identity"}
        </button>
        {updateOrgMut.isSuccess && !updateOrgMut.isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Identity saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Sub-tab plumbing ────────────────────────────────────────────────────
//
// UFB-048 (Phase 48-B): the three sub-tabs share an updateSettings mutation
// helper. We keep the per-tab state local (each sub-tab owns its own draft +
// dirty flag) but the mutation itself is a thin reusable wrapper so the
// "Saved" toasts and onError messages stay consistent across tabs.

function useUpdateSettingsMut(label: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation(
    trpc.admin.updateSettings.mutationOptions({
      onSuccess: async () => {
        invalidateAdmin(qc, trpc);
        // A9: invalidate landing page cache on any settings change
        await fetch('/api/revalidate-org', { method: 'POST' });
        toast.success(`${label} saved`);
      },
      onError: (err) => {
        toast.error(err.message ?? `Failed to save ${label.toLowerCase()}`);
      },
    }),
  );
}

// ─── Periods sub-tab ─────────────────────────────────────────────────────

function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Period settings");

  function handleSave() {
    // PATCH semantics — only fields owned by this sub-tab go on the wire.
    // UFB-047 / Phase 49-01: `departmentName` is no longer part of the
    // payload; brand identity lives on the Organization singleton (Identity
    // tab) and is mutated via `admin.updateOrganization`.
    // UFB-051 (Phase 51-A): the 8 new period-cycle knobs are bundled into
    // this same PATCH because they live on the Periods tab. Cron consumers
    // arrive in 51-C; today these only flow through the wire and persist.
    updateSettingsMut.mutate({
      autoCreatePeriods: draft.autoCreatePeriods,
      defaultDeadlineDays: draft.defaultDeadlineDays,
      periodLengthDays: draft.periodLengthDays,
      workingDays: draft.workingDays,
      gracePeriodHours: draft.gracePeriodHours,
      allowLateSubmissions: draft.allowLateSubmissions,
      autoPublishAfterDeadline: draft.autoPublishAfterDeadline,
      autoArchiveWeeksAfterPublish: draft.autoArchiveWeeksAfterPublish,
      firstDayOfWeek: draft.firstDayOfWeek,
      deadlineDayOfWeek: draft.deadlineDayOfWeek,
      deadlineTime: draft.deadlineTime,
      maxOpenPeriods: draft.maxOpenPeriods,
      requireAllSectionsToPublish: draft.requireAllSectionsToPublish,
      allowReopenAfterPublish: draft.allowReopenAfterPublish,
      reopenWindowHours: draft.reopenWindowHours,
    });
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      {/* UFB-047 / Phase 49-01: legacy `departmentName` deprecation banner
          + input removed alongside the AppSettings column. Brand identity
          (short + full name) is owned by the Identity tab. */}

      {/* ── periodLengthDays (UFB-048) ── */}
      <div>
        <label
          htmlFor="period-length-days"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Period length (days)
        </label>
        <input
          id="period-length-days"
          name="period-length-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={draft.periodLengthDays}
          onChange={(e) =>
            setDraft({
              ...draft,
              periodLengthDays: Number.parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          How many days each reporting period spans (default 7 = weekly).
        </p>
      </div>

      {/* ── workingDays (UFB-048) ── */}
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
          Working days
        </legend>
        <div className="flex flex-col gap-2">
          {(["mon-fri", "mon-sat", "mon-sun"] as const).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
            >
              <input
                type="radio"
                name="working-days"
                value={opt}
                checked={draft.workingDays === opt}
                onChange={() => setDraft({ ...draft, workingDays: opt })}
                className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
              />
              <span>
                {opt === "mon-fri" && "Mon-Fri (5-day week)"}
                {opt === "mon-sat" && "Mon-Sat (6-day week)"}
                {opt === "mon-sun" && "Mon-Sun (7-day week)"}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Metadata only in v1 — UI hint for admins. Deadline math still uses
          Mon-Fri until a follow-up plan wires the calendar logic.
        </p>
      </fieldset>

      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="auto-create-periods"
          type="checkbox"
          checked={draft.autoCreatePeriods}
          onChange={(e) =>
            setDraft({ ...draft, autoCreatePeriods: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Auto-create periods</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Create the next reporting period automatically when the schedule
            advances.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="deadline-days"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Default deadline days
        </label>
        <input
          id="deadline-days"
          name="deadline-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={draft.defaultDeadlineDays}
          onChange={(e) =>
            setDraft({
              ...draft,
              defaultDeadlineDays: Number.parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Number of days after period start before reports are due.
        </p>
      </div>

      {/* ── gracePeriodHours (UFB-048) ── */}
      <div>
        <label
          htmlFor="grace-period-hours"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Grace period (hours)
        </label>
        <input
          id="grace-period-hours"
          name="grace-period-hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={168}
          value={draft.gracePeriodHours}
          onChange={(e) =>
            setDraft({
              ...draft,
              gracePeriodHours: Math.max(
                0,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Late submissions accepted within this many hours past the deadline
          when «allow late submissions» is on. Must be 0..168 (one week).
        </p>
      </div>

      {/* ── allowLateSubmissions (UFB-048) ── */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="allow-late-submissions"
          type="checkbox"
          checked={draft.allowLateSubmissions}
          onChange={(e) =>
            setDraft({ ...draft, allowLateSubmissions: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Allow late submissions</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            When on, leads can submit within the grace window above. When off,
            the deadline is hard — submissions past the deadline are rejected.
          </span>
        </span>
      </label>

      {/* ── autoPublishAfterDeadline (UFB-048) ── */}
      <label
        className={`flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)] ${
          draft.autoCreatePeriods ? "" : "opacity-60"
        }`}
      >
        <input
          name="auto-publish-after-deadline"
          type="checkbox"
          disabled={!draft.autoCreatePeriods}
          checked={draft.autoPublishAfterDeadline}
          onChange={(e) =>
            setDraft({ ...draft, autoPublishAfterDeadline: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)] disabled:cursor-not-allowed"
        />
        <span>
          <span className="block font-medium">Auto-publish after deadline</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Scheduler publishes the period at <code>deadline + grace</code>;
            missing sections render «Не сдал» placeholder. Scheduler logic is
            deferred — toggle is persisted, the cron consumer arrives in a
            follow-up plan.
            {!draft.autoCreatePeriods && (
              <>
                {" "}
                <b>Requires «Auto-create periods».</b>
              </>
            )}
          </span>
        </span>
      </label>

      {/* ── autoArchiveWeeksAfterPublish (UFB-048) ── */}
      <div>
        <label
          htmlFor="auto-archive-weeks"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Auto-archive published periods after (weeks)
        </label>
        <input
          id="auto-archive-weeks"
          name="auto-archive-weeks"
          type="number"
          inputMode="numeric"
          min={0}
          max={52}
          value={draft.autoArchiveWeeksAfterPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              autoArchiveWeeksAfterPublish: Math.max(
                0,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          0 = never archive. Otherwise: a published period drops out of the
          default «active» views after N weeks.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          UFB-051 (Phase 51-A) — Period-cycle knobs.

          These inputs persist the new AppSettings columns landed in
          migration 20260510215245_period_model_expansion. Consumers
          (PeriodCreator cadence-aware step, publish/reopen gating)
          ship in Phase 51-C — today the values only round-trip.
          ───────────────────────────────────────────────────────────── */}

      {/* ── firstDayOfWeek (UFB-051) ─────────────────────────────── */}
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
          First day of week
        </legend>
        <div className="flex gap-4">
          {(
            [
              { value: 1, label: "Monday (ISO)" },
              { value: 7, label: "Sunday" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm text-[var(--color-foreground)]"
            >
              <input
                type="radio"
                name="first-day-of-week"
                value={opt.value}
                checked={draft.firstDayOfWeek === opt.value}
                onChange={() =>
                  setDraft({ ...draft, firstDayOfWeek: opt.value })
                }
                className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Anchor for «week N» labels and the weekly cadence start. ISO weekday
          numbering (1=Mon..7=Sun). Calendar-anchoring logic ships in Phase
          51-C.
        </p>
      </fieldset>

      {/* ── deadlineDayOfWeek (UFB-051) ──────────────────────────── */}
      <div>
        <label
          htmlFor="deadline-day-of-week"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Deadline day of week
        </label>
        <select
          id="deadline-day-of-week"
          name="deadline-day-of-week"
          value={draft.deadlineDayOfWeek}
          onChange={(e) =>
            setDraft({
              ...draft,
              deadlineDayOfWeek: Number.parseInt(e.target.value, 10) || 5,
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <option value={1}>Monday</option>
          <option value={2}>Tuesday</option>
          <option value={3}>Wednesday</option>
          <option value={4}>Thursday</option>
          <option value={5}>Friday</option>
          <option value={6}>Saturday</option>
          <option value={7}>Sunday</option>
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Which day each period's deadline falls on. ISO numbering
          (1=Mon..7=Sun). Default Friday.
        </p>
      </div>

      {/* ── deadlineTime (UFB-051) ───────────────────────────────── */}
      <div>
        <label
          htmlFor="deadline-time"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Deadline time
        </label>
        <input
          id="deadline-time"
          name="deadline-time"
          type="time"
          step={60}
          value={draft.deadlineTime}
          onChange={(e) =>
            setDraft({ ...draft, deadlineTime: e.target.value || "18:00" })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          HH:MM in the default timezone (Reminders tab). Default 18:00.
        </p>
      </div>

      {/* ── maxOpenPeriods (UFB-051) ─────────────────────────────── */}
      <div>
        <label
          htmlFor="max-open-periods"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Max open periods
        </label>
        <input
          id="max-open-periods"
          name="max-open-periods"
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          value={draft.maxOpenPeriods}
          onChange={(e) =>
            setDraft({
              ...draft,
              maxOpenPeriods: Math.max(
                1,
                Number.parseInt(e.target.value, 10) || 1,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Cap on simultaneously-open periods. PeriodCreator will skip
          auto-create when N periods are already open (51-C consumer).
        </p>
      </div>

      {/* ── requireAllSectionsToPublish (UFB-051) ────────────────── */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="require-all-sections-to-publish"
          type="checkbox"
          checked={draft.requireAllSectionsToPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              requireAllSectionsToPublish: e.target.checked,
            })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">
            Require all sections to publish
          </span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            When on, the head cannot publish until every lead has submitted.
            When off, missing sections render «Не сдал» placeholder. Enforcement
            ships in Phase 51-C.
          </span>
        </span>
      </label>

      {/* ── allowReopenAfterPublish + reopenWindowHours (UFB-051) ─ */}
      <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-foreground)]">
        <input
          name="allow-reopen-after-publish"
          type="checkbox"
          checked={draft.allowReopenAfterPublish}
          onChange={(e) =>
            setDraft({
              ...draft,
              allowReopenAfterPublish: e.target.checked,
            })
          }
          className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
        />
        <span>
          <span className="block font-medium">Allow reopen after publish</span>
          <span className="block text-xs text-[var(--color-muted-foreground)]">
            Lets the head reopen a published period for late corrections. Window
            enforcement ships in Phase 51-C.
          </span>
        </span>
      </label>

      <div
        className={
          draft.allowReopenAfterPublish ? "" : "pointer-events-none opacity-60"
        }
      >
        <label
          htmlFor="reopen-window-hours"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Reopen window (hours)
        </label>
        <input
          id="reopen-window-hours"
          name="reopen-window-hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={168}
          disabled={!draft.allowReopenAfterPublish}
          value={draft.reopenWindowHours}
          onChange={(e) =>
            setDraft({
              ...draft,
              reopenWindowHours: Math.max(
                0,
                Number.parseInt(e.target.value, 10) || 0,
              ),
            })
          }
          className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          How long after publish a period can still be reopened. 0..168 (one
          week). Greyed out when «allow reopen» is off.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save period settings"
        >
          {isSaving ? "Saving…" : "Save Period Settings"}
        </button>
        {updateSettingsMut.isSuccess && !updateSettingsMut.isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Period settings saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Reminders sub-tab (UFB-048) ─────────────────────────────────────────

function RemindersSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Reminder defaults");

  function handleSave() {
    updateSettingsMut.mutate({
      defaultTimezone: draft.defaultTimezone,
      defaultReminderAudience: draft.defaultReminderAudience,
    });
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Defaults applied to the «New Policy» form on the Reminders tab. Existing
        policies keep their per-policy values.
      </p>

      <div>
        <label
          htmlFor="default-timezone"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Default timezone
        </label>
        <select
          id="default-timezone"
          name="default-timezone"
          value={draft.defaultTimezone}
          onChange={(e) =>
            setDraft({ ...draft, defaultTimezone: e.target.value })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          {TIMEZONE_OPTIONS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.zones.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          IANA zone used as default when admins create a new ReminderPolicy.
        </p>
      </div>

      <div>
        <label
          htmlFor="default-audience"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Default audience
        </label>
        <select
          id="default-audience"
          name="default-audience"
          value={draft.defaultReminderAudience}
          onChange={(e) =>
            setDraft({
              ...draft,
              defaultReminderAudience: e.target
                .value as MockSettings["defaultReminderAudience"],
            })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <option value="lead-with-draft">Leads with draft</option>
          <option value="head-of-late">Head of late leads</option>
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Recipient group preselected on the «New Policy» form.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save reminder defaults"
        >
          {isSaving ? "Saving…" : "Save Reminder Defaults"}
        </button>
        {updateSettingsMut.isSuccess && !updateSettingsMut.isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Reminder defaults saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Notifications sub-tab (UFB-048) ─────────────────────────────────────

function NotificationsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const [draft, setDraft] = useState<MockSettings>(serverSettings);
  useEffect(() => setDraft(serverSettings), [serverSettings]);
  const updateSettingsMut = useUpdateSettingsMut("Notification settings");

  // The wire schema accepts null (clear) or a valid email; we keep the input
  // as a string and translate empty → null on save. UI guard: a non-empty
  // string that fails a basic email shape blocks Save with a hint.
  const trimmed = draft.notificationFromEmail?.trim() ?? "";
  const looksLikeEmail =
    trimmed === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  function handleSave() {
    updateSettingsMut.mutate({
      notificationFromEmail: trimmed === "" ? null : trimmed,
    });
  }
  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Used as the From: address on outgoing reminder + escalation emails.
        Leave blank to fall back to the per-mailer default.
      </p>

      <div>
        <label
          htmlFor="notification-from-email"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Notification from-email
        </label>
        <input
          id="notification-from-email"
          name="notification-from-email"
          type="email"
          autoComplete="off"
          placeholder="reports@example.com"
          value={draft.notificationFromEmail ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              notificationFromEmail:
                e.target.value === "" ? null : e.target.value,
            })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        {!looksLikeEmail && (
          <p className="mt-1 text-xs text-red-600">
            Enter a valid email or leave the field empty.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !looksLikeEmail}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Save notification settings"
        >
          {isSaving ? "Saving…" : "Save Notification Settings"}
        </button>
        {updateSettingsMut.isSuccess && !updateSettingsMut.isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
            <CheckIcon />
            Notification settings saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Integrations sub-tab (UFB-056 / Phase 55-5) ────────────────────────

/**
 * Read-only status surface for external integrations. v1 only shows
 * Telegram: green «Подключён» badge when both `TG_BOT_TOKEN` is set on
 * the API AND at least one active TelegramBinding row exists. Otherwise
 * muted «Не активно».
 *
 * Phase 55 is seeds-only: there is no real bot, no user-binding UI, no
 * outbound flow beyond the admin smoke-test (which lives on the API
 * surface only, not exposed in this tab). The card text states that
 * explicitly so a head/admin reading the tab does not expect /start to
 * work yet.
 */
function IntegrationsSubTab() {
  const trpc = useTRPC();
  const statusQ = useQuery(trpc.admin.integrationsStatus.queryOptions());

  if (statusQ.isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Loading integrations status…
      </p>
    );
  }

  if (statusQ.isError || !statusQ.data) {
    return (
      <p className="text-sm text-red-600">
        Failed to load integrations status.
      </p>
    );
  }

  const { telegram, ci } = statusQ.data;
  const isTelegramActive = telegram.configured && telegram.bindings > 0;
  const isCiConfigured = ci?.configured ?? false;

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        External integrations available to CustomReport. Activation requires
        admin-issued credentials and a follow-on rollout phase.
      </p>

      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4"
        data-testid="integration-row-telegram"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Telegram
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Привязка пользователей и реальный бот будут добавлены в отдельной
              фазе.
            </p>
          </div>
          {isTelegramActive ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]"
              data-testid="integration-badge-telegram"
              data-state="active"
            >
              Подключён
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]"
              data-testid="integration-badge-telegram"
              data-state="inactive"
            >
              Не активно
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
          <dt>Bot configured</dt>
          <dd
            className="font-mono"
            data-testid="integration-telegram-configured"
          >
            {telegram.configured ? "yes" : "no"}
          </dd>
          <dt>Active bindings</dt>
          <dd className="font-mono" data-testid="integration-telegram-bindings">
            {telegram.bindings}
          </dd>
        </dl>
      </div>

      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4"
        data-testid="integration-row-ci"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              CI Integration
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Connect your CI/CD pipeline for automated report triggers.
            </p>
          </div>
          {isCiConfigured ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]"
              data-testid="integration-badge-ci"
              data-state="configured"
            >
              Configured
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]"
              data-testid="integration-badge-ci"
              data-state="not-configured"
            >
              Not configured
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
