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

import type { MockSettings } from "./mock-data";

type SettingsTabProps = {
  readonly settings: MockSettings;
};

/**
 * UFB-047 / Phase 48-A: Settings tab restructured into a tabbed layout.
 *
 * Tab order is intentional:
 *   1. Identity     — Organization singleton (this plan).
 *   2. Periods      — autoCreatePeriods + defaultDeadlineDays + the
 *                     deprecated AppSettings.departmentName banner.
 *   3. Reminders    — placeholder for Phase 48-B.
 *   4. Notifications — placeholder for Phase 48-B.
 *
 * The departmentName field still lives on AppSettings for one release; the
 * Identity tab is the new source of truth (Organization.fullName). Once
 * downstream consumers (lead-form, weekly-report) migrate to Organization,
 * a follow-up plan will drop AppSettings.departmentName.
 */
export function SettingsTab({ settings: serverSettings }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader
        title="Settings"
        description="Organization identity, period defaults, and notification preferences."
      />

      <Tabs defaultValue="identity" className="w-full">
        <TabsList variant="line" className="border-b border-[var(--color-border)]">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="pt-6">
          <IdentitySubTab />
        </TabsContent>

        <TabsContent value="periods" className="pt-6">
          <PeriodsSubTab serverSettings={serverSettings} />
        </TabsContent>

        <TabsContent value="reminders" className="pt-6">
          <PlaceholderSubTab
            title="Reminders"
            description="Per-policy reminder configuration arrives in Phase 48-B."
          />
        </TabsContent>

        <TabsContent value="notifications" className="pt-6">
          <PlaceholderSubTab
            title="Notifications"
            description="Per-user notification opt-outs and channel routing arrive in Phase 48-B."
          />
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
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
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
            Shown on the landing hero and in PDF report headers (max 200
            chars).
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

// ─── Periods sub-tab ─────────────────────────────────────────────────────

function PeriodsSubTab({
  serverSettings,
}: {
  readonly serverSettings: MockSettings;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<MockSettings>(serverSettings);

  useEffect(() => {
    setDraft(serverSettings);
  }, [serverSettings]);

  const updateSettingsMut = useMutation(
    trpc.admin.updateSettings.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Period settings saved");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to save period settings");
      },
    }),
  );

  function handleSave() {
    updateSettingsMut.mutate({
      departmentName: draft.departmentName,
      autoCreatePeriods: draft.autoCreatePeriods,
      defaultDeadlineDays: draft.defaultDeadlineDays,
    });
  }

  const isSaving = updateSettingsMut.isPending;

  return (
    <div className="max-w-lg space-y-5">
      {/* UFB-047 / Phase 48-A: departmentName is being deprecated in favour
          of the Organization singleton. The banner alerts admins; the field
          stays editable for one release so downstream consumers (lead-form,
          weekly-report) keep working until a follow-up plan rewires them. */}
      <div
        className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        role="status"
      >
        <p className="font-semibold">Department name is being deprecated.</p>
        <p className="mt-1">
          Use the <b>Identity</b> tab for the brand name shown in the
          nav-bar, landing hero, and PDF headers. This field still appears in
          legacy report sections; a follow-up plan will rewire those to read
          from Identity and drop the field entirely.
        </p>
      </div>

      <div>
        <label
          htmlFor="dept-name"
          className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
        >
          Report header name (legacy)
        </label>
        <input
          id="dept-name"
          name="department-name"
          type="text"
          autoComplete="off"
          value={draft.departmentName}
          onChange={(e) =>
            setDraft({ ...draft, departmentName: e.target.value })
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Displayed in legacy report sections. User membership is managed in
          Departments.
        </p>
      </div>

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

// ─── Placeholder sub-tab (Reminders / Notifications) ─────────────────────

function PlaceholderSubTab({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="max-w-lg rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-white p-6 text-sm">
      <p className="font-semibold text-[var(--color-foreground)]">
        {title} — coming in next release
      </p>
      <p className="mt-2 text-[var(--color-muted-foreground)]">{description}</p>
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
