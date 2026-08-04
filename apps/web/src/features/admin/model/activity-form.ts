import type { ProjectActivity } from "@customreport/shared";

export interface ActivityFormData {
  readonly name: string;
  // null = no group selectable; never an empty-string group id.
  readonly groupId: string | null;
  readonly linkedProductIds: readonly string[];
  // Raw comma-separated text; the wire array is derived on save so the admin
  // can type freely without the field fighting each keystroke.
  readonly jiraAccounts: string;
}

export const EMPTY_ACTIVITY_FORM: ActivityFormData = {
  name: "",
  groupId: null,
  linkedProductIds: [],
  jiraAccounts: "",
};

export function formFromActivity(activity: ProjectActivity): ActivityFormData {
  return {
    name: activity.name,
    groupId: activity.groupId,
    linkedProductIds: activity.linkedProducts.map((link) => link.productId),
    jiraAccounts: activity.jiraAccounts.join(", "),
  };
}

export function parseJiraAccounts(raw: string): readonly string[] {
  return raw
    .split(",")
    .map((account) => account.trim())
    .filter((account) => account.length > 0);
}

export function toggleLinkedProduct(
  form: ActivityFormData,
  productId: string,
  checked: boolean,
): ActivityFormData {
  return {
    ...form,
    linkedProductIds: checked
      ? [...form.linkedProductIds, productId]
      : form.linkedProductIds.filter((id) => id !== productId),
  };
}
