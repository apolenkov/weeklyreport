import type {
  StatusOverviewUnit,
  StatusOverviewUnitKind,
} from "../model/status-overview";
import type { buildStatusOverviewLineage } from "../model/status-overview-lineage";
import type { OpenHealthDetail } from "./report-health-pulse";
import { StatusOverviewActivityEditor } from "./status-overview-activity-editor";
import {
  type ActivityFieldsDisclosure,
  ActivityFieldsEditButton,
  useActivityFieldsDisclosure,
} from "./status-overview-activity-fields";
import type { StatusOverviewProps } from "./status-overview-props";
import { StatusOverviewUnitRow } from "./status-overview-row";

export const UNIT_GROUPS: readonly {
  readonly kind: StatusOverviewUnitKind;
  readonly label: string;
}[] = [
  { kind: "product", label: "Products" },
  { kind: "activity", label: "Project activities" },
];

interface UnitGroupProps {
  readonly group: (typeof UNIT_GROUPS)[number];
  readonly idPrefix: string;
  readonly overview: StatusOverviewProps;
  readonly lineage: ReturnType<typeof buildStatusOverviewLineage>;
  readonly inspectionKey: string | undefined;
  readonly healthPanelId: string;
  readonly onInspect: OpenHealthDetail;
  readonly onCloseHealth: () => void;
  readonly expandedKeys: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
  readonly onAddItem: StatusOverviewProps["onAddItem"];
}

function canEditActivityFields(
  overview: StatusOverviewProps,
  unit: StatusOverviewUnit,
): boolean {
  return (
    unit.kind === "activity" &&
    overview.activityFieldsEditable === true &&
    !unit.historical &&
    overview.onActivityFieldsChange !== undefined &&
    unit.activityFields !== undefined
  );
}

function ActivityFieldsForm({
  overview,
  unit,
  disclosure,
}: {
  readonly overview: StatusOverviewProps;
  readonly unit: StatusOverviewUnit;
  readonly disclosure: ActivityFieldsDisclosure;
}) {
  if (
    !canEditActivityFields(overview, unit) ||
    !disclosure.isOpen(unit.id) ||
    overview.onActivityFieldsChange === undefined ||
    unit.activityFields === undefined
  ) {
    return null;
  }
  return (
    <StatusOverviewActivityEditor
      activityId={unit.id}
      values={unit.activityFields}
      onChange={overview.onActivityFieldsChange}
      onPendingChange={overview.onActivityFieldsPendingChange}
      onClose={() => disclosure.setOpen(unit.id, false)}
    />
  );
}

function UnitGroupHeader({
  groupId,
  label,
  count,
}: {
  readonly groupId: string;
  readonly label: string;
  readonly count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--color-surface-muted)] px-4 py-2">
      <h3
        id={groupId}
        className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]"
      >
        {label}
      </h3>
      <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
        {count}
      </span>
    </div>
  );
}

export function UnitGroup({
  group,
  idPrefix,
  overview,
  lineage,
  inspectionKey,
  healthPanelId,
  onInspect,
  onCloseHealth,
  expandedKeys,
  onToggle,
  onAddItem,
}: UnitGroupProps) {
  const { model, health, editorSlot } = overview;
  const disclosure = useActivityFieldsDisclosure();
  const units = model.units.filter((unit) => unit.kind === group.kind);
  if (units.length === 0) return null;
  const groupId = `${idPrefix}-${group.kind}-heading`;
  return (
    <section
      aria-labelledby={groupId}
      className="border-t border-[var(--color-border-subtle)] first:border-t-0"
    >
      <UnitGroupHeader
        groupId={groupId}
        label={group.label}
        count={units.length}
      />
      {units.map((unit, index) => (
        <div key={unit.key} className="min-w-0">
          <StatusOverviewUnitRow
            unit={unit}
            health={health?.units.find((entry) => entry.key === unit.key)}
            healthPanelId={healthPanelId}
            healthExpanded={inspectionKey === unit.key}
            onInspect={onInspect}
            onCloseHealth={onCloseHealth}
            rows={lineage.get(unit.key) ?? []}
            periods={model.periods}
            expanded={expandedKeys.has(unit.key)}
            onToggle={() => onToggle(unit.key)}
            panelId={`${idPrefix}-${group.kind}-${String(index)}`}
            onEditItem={overview.onEditItem}
            onEditItemText={overview.onEditItemText}
            onAddItem={onAddItem}
            onPlanItem={overview.onPlanItem}
            onMoveItem={overview.onMoveItem}
            onConfirmItem={overview.onConfirmItem}
            onSetStatus={overview.onSetStatus}
            onResolvePlan={overview.onResolvePlan}
            onRestorePlan={overview.onRestorePlan}
            onVerdict={overview.onVerdict}
            editorSlot={
              editorSlot?.unitKey === unit.key ? editorSlot : undefined
            }
            headerAction={
              canEditActivityFields(overview, unit) ? (
                <ActivityFieldsEditButton
                  activityId={unit.id}
                  name={unit.name}
                  disclosure={disclosure}
                />
              ) : undefined
            }
          />
          <ActivityFieldsForm
            overview={overview}
            unit={unit}
            disclosure={disclosure}
          />
        </div>
      ))}
    </section>
  );
}
