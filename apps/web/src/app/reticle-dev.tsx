"use client";
import { useEffect } from "react";

/** Dev-only: connect Reticle + install the React adapter, after hydration. */
export function ReticleDev() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void import("@reticlehq/react").then(
      ({ reticle, install, registerCapabilities }) => {
        install();
        // Both provided by withReticle() in next.config. The bridge rejects a connect with no token;
        // the root makes source paths repo-relative instead of absolute.
        const token = process.env.NEXT_PUBLIC_RETICLE_TOKEN;
        const root = process.env.NEXT_PUBLIC_RETICLE_ROOT;
        // withReticle() finds the daemon serving this project on every dev-server start. It wins over
        // any port written into this file at install time, so moving the daemon needs no edit here.
        const url = process.env.NEXT_PUBLIC_RETICLE_URL;
        reticle.connect({
          projectId: "customreport-web-60381801",
          captureNetworkBodies: true,
          ...(url ? { url } : {}),
          ...(token ? { token } : {}),
          ...(root ? { root } : {}),
        });

        // ── Start with ONE flow. ────────────────────────────────────────────────────────────────
        // Registering a store is the highest-value line here: it lets the agent check what the app
        // BELIEVES, not just what it rendered. Pass the STORE, not `() => store.getState()` — the
        // store form wires `subscribe` too, so every mutation emits a diff; the getter form is
        // read-only.
        // No state library detected. If you add one, register it here — see node_modules/@reticlehq/server/docs/usage.md.
        registerCapabilities({
          testids: [
            "last-role-switcher",
            "primary-cta",
            "last-role-hint-skeleton",
            "last-role-hint",
            "role-picker",
            "landing-session-error",
            "last-role-status",
            "admin-panel",
            "report-page",
            "lead-form",
            "lead-form-skeleton",
            "viewer-report-shell",
            "weekly-report-skeleton",
            "print-report-template",
            "action-log-tab",
            "product-group-chips-stub",
            "stage-assignment-editor-stub",
            "confirm-archive-dialog",
            "activities-table",
            "activity-linked-products",
            "activity-leads-editor",
            "activity-leads-list",
            "skeleton-table-grid",
            "group-dialog-body",
            "group-products-list",
            "group-products-editor",
            "group-products-loading",
            "crud-sheet",
            "groups-tab",
            "groups-table",
            "jobs-loading-state",
            "lead-product-count",
            "lead-product-overcap",
            "product-group-chips",
            "search-input-stub",
            "confirm-delete-dialog",
            "products-table",
            "users-table",
            "jobs-error-state",
            "jobs-empty-state",
            "jobs-table",
            "jobs-tab",
            "reminder-advanced",
            "policy-validity-hint",
            "policy-save-button",
            "policy-form",
            "reminders-empty-state",
            "new-policy-button",
          ],
          signals: [], // names you pass to reticle.signal()
          stores: [], // the keys you registered above
        });
      },
    );
  }, []);
  return null;
}
