"use client";

import {
  type ActivityFormData,
  toggleLinkedProduct,
} from "../model/activity-form";
import type { AdminGroupView, AdminProductView } from "../model/admin-types";

const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_CONTROL_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const HINT_CLASS = "mt-1.5 text-xs text-[var(--color-muted-foreground)]";

function ActivityNameField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="activity-name" className={FIELD_LABEL_CLASS}>
        Activity Name
      </label>
      <input
        id="activity-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CONTROL_CLASS}
      />
    </div>
  );
}

// The server rejects a group move while leads are attached, so the picker locks
// rather than letting the admin submit into a guaranteed error.
function ReportingGroupField({
  value,
  onChange,
  groups,
  lockedByLeads,
}: {
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly groups: readonly AdminGroupView[];
  readonly lockedByLeads: boolean;
}) {
  return (
    <div>
      <label htmlFor="activity-group" className={FIELD_LABEL_CLASS}>
        Reporting Group
      </label>
      <select
        id="activity-group"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={lockedByLeads}
        aria-describedby={lockedByLeads ? "activity-group-locked" : undefined}
        className={`${FIELD_CONTROL_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {value === null && (
          <option value="" disabled>
            Select group…
          </option>
        )}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      {lockedByLeads ? (
        <p id="activity-group-locked" role="note" className={HINT_CLASS}>
          Detach all leads before moving the activity to another group.
        </p>
      ) : null}
    </div>
  );
}

function LinkedProductsField({
  form,
  onFormChange,
  products,
}: {
  readonly form: ActivityFormData;
  readonly onFormChange: (form: ActivityFormData) => void;
  readonly products: readonly AdminProductView[];
}) {
  const linkedProductIds: ReadonlySet<string> = new Set(form.linkedProductIds);

  return (
    <fieldset>
      <legend className={FIELD_LABEL_CLASS}>Linked Products</legend>
      <p className={`mb-1 ${HINT_CLASS}`}>
        Label-only links. They never feed a product&apos;s health.
      </p>
      {products.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          No active products to link.
        </p>
      ) : (
        <ul
          className="max-h-32 space-y-1 overflow-y-auto pr-1"
          data-testid="activity-linked-products"
        >
          {products.map((product) => (
            <li key={product.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={linkedProductIds.has(product.id)}
                  onChange={(e) =>
                    onFormChange(
                      toggleLinkedProduct(form, product.id, e.target.checked),
                    )
                  }
                  aria-label={`Link ${product.name}`}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                {product.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function JiraAccountsField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="activity-jira" className={FIELD_LABEL_CLASS}>
        Jira Accounts
      </label>
      <input
        id="activity-jira"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ACME, PLATFORM"
        className={FIELD_CONTROL_CLASS}
      />
      <p className={HINT_CLASS}>Comma-separated.</p>
    </div>
  );
}

export function ActivityFormFields({
  form,
  onFormChange,
  groups,
  products,
  groupLockedByLeads,
}: {
  readonly form: ActivityFormData;
  readonly onFormChange: (form: ActivityFormData) => void;
  readonly groups: readonly AdminGroupView[];
  readonly products: readonly AdminProductView[];
  readonly groupLockedByLeads: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <ActivityNameField
        value={form.name}
        onChange={(name) => onFormChange({ ...form, name })}
      />
      <ReportingGroupField
        value={form.groupId}
        onChange={(groupId) => onFormChange({ ...form, groupId })}
        groups={groups}
        lockedByLeads={groupLockedByLeads}
      />
      <LinkedProductsField
        form={form}
        onFormChange={onFormChange}
        products={products}
      />
      <JiraAccountsField
        value={form.jiraAccounts}
        onChange={(jiraAccounts) => onFormChange({ ...form, jiraAccounts })}
      />
    </div>
  );
}
