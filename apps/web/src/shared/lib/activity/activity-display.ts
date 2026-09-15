// Single owner of the weekly-title rule: a non-blank override wins, otherwise
// the catalogue name. Consumers must use this instead of reading activityName
// or titleOverride directly so a published snapshot stays label-consistent.

/** Minimal shape both the read model and its projections satisfy. */
export interface ActivityTitleFields {
  readonly activityName: string;
  readonly titleOverride?: string | null | undefined;
}

/** Effective activity title for any live or frozen projection. */
export function activityDisplayTitle(activity: ActivityTitleFields): string {
  const override = activity.titleOverride?.trim();
  return override ? override : activity.activityName;
}
