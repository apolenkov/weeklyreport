"use client";

import type { ChipChoice } from "../../../shared/ui/forms/choice-chip-row";
import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";
import type { ItemStatus, Product } from "../model/types";
import type { StatusSlot } from "./item-edit-dialog-helpers";
import { PausedReasonField } from "./item-paused-reason-field";
import { StatusSlotView } from "./item-status-slot";
import {
  type ParentActivityOption,
  ParentPicker,
  type RecordParent,
} from "./parent-picker";
import { StageStep } from "./stage-step";

export interface ItemEditDialogFieldsProps {
  readonly text: string;
  readonly onTextChange: (value: string) => void;
  readonly textError: string | undefined;
  readonly priorityRank: number | null;
  readonly onPriorityRankChange: (next: number | null) => void;
  readonly rankOptions: readonly number[];
  readonly takenRanks: ReadonlySet<number>;
  readonly week: "current" | "next";
  readonly parent: RecordParent;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly onParentChange: (next: RecordParent) => void;
  readonly isActivityParent: boolean;
  readonly stageNames: string[];
  readonly availableStages: readonly string[];
  readonly isDeadEnd: boolean;
  readonly stageError: string | undefined;
  readonly parentName: string;
  readonly onStageChange: (next: string[]) => void;
  readonly statusSlot: StatusSlot;
  readonly choices: readonly ChipChoice<ItemStatus>[];
  readonly status: ItemStatus;
  readonly onStatusSelect: (value: ItemStatus) => void;
  readonly pausedReason: string;
  readonly pausedReasonError: string | undefined;
  readonly onPausedReasonChange: (next: string) => void;
}

type ItemDescriptionProps = Pick<
  ItemEditDialogFieldsProps,
  "text" | "onTextChange" | "textError" | "week"
>;

type ItemPriorityRankProps = Pick<
  ItemEditDialogFieldsProps,
  "priorityRank" | "onPriorityRankChange" | "rankOptions" | "takenRanks"
>;

type ItemClassificationProps = ItemParentStageProps & ItemStatusProps;

function ItemDescriptionField({
  text,
  onTextChange,
  textError,
  week,
}: ItemDescriptionProps) {
  return (
    <RecordTextareaField
      id="item-text"
      label="Description"
      required
      value={text}
      onChange={onTextChange}
      error={textError}
      placeholder={
        week === "current"
          ? "What was done or in progress…"
          : "What is planned for next week…"
      }
      minHeightPx={70}
      focusOnMount
    />
  );
}

function ItemPriorityRankField({
  priorityRank,
  onPriorityRankChange,
  rankOptions,
  takenRanks,
}: ItemPriorityRankProps) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor="item-priority-rank"
      >
        Priority rank{" "}
        <span className="font-normal">
          (optional — leave blank if not a priority)
        </span>
      </label>
      <select
        id="item-priority-rank"
        className="select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-card)] py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)] focus:outline-none"
        value={priorityRank ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onPriorityRankChange(v === "" ? null : Number.parseInt(v, 10));
        }}
      >
        <option value="">— none —</option>
        {rankOptions.map((r) => {
          const taken = takenRanks.has(r);
          return (
            <option key={r} value={r} disabled={taken}>
              {r}
              {taken ? " (taken)" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

type ItemParentStageProps = Pick<
  ItemEditDialogFieldsProps,
  | "parent"
  | "products"
  | "activities"
  | "onParentChange"
  | "isActivityParent"
  | "stageNames"
  | "availableStages"
  | "isDeadEnd"
  | "stageError"
  | "parentName"
  | "onStageChange"
>;

type ItemStatusProps = Pick<
  ItemEditDialogFieldsProps,
  | "statusSlot"
  | "choices"
  | "status"
  | "onStatusSelect"
  | "pausedReason"
  | "pausedReasonError"
  | "onPausedReasonChange"
>;

function ItemParentStageFields({
  parent,
  products,
  activities,
  onParentChange,
  isActivityParent,
  stageNames,
  availableStages,
  isDeadEnd,
  stageError,
  parentName,
  onStageChange,
}: ItemParentStageProps) {
  return (
    <>
      <ParentPicker
        id="item-product"
        value={parent}
        products={products}
        activities={activities}
        onChange={onParentChange}
      />

      {/* Stage step is product-only — activities own no SDLC stage. */}
      {!isActivityParent && (
        <StageStep
          id="item-stage"
          stageNames={stageNames}
          availableStages={availableStages}
          isDeadEnd={isDeadEnd}
          error={stageError}
          deadEndNotice={`No stages assigned on ${parentName} — contact admin.`}
          onChange={(next) => onStageChange([...next])}
        />
      )}
    </>
  );
}

function ItemStatusFields({
  statusSlot,
  choices,
  status,
  onStatusSelect,
  pausedReason,
  pausedReasonError,
  onPausedReasonChange,
}: ItemStatusProps) {
  return (
    <>
      <StatusSlotView
        slot={statusSlot}
        choices={choices}
        status={status}
        onSelect={onStatusSelect}
      />

      {status === "paused" && (
        <PausedReasonField
          value={pausedReason}
          error={pausedReasonError}
          onChange={onPausedReasonChange}
        />
      )}
    </>
  );
}

function ItemClassificationColumn(props: ItemClassificationProps) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
        Classification
      </span>

      <ItemParentStageFields {...props} />
      <ItemStatusFields {...props} />
    </div>
  );
}

export function ItemEditDialogFields(props: ItemEditDialogFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
      <div className="flex flex-1 flex-col gap-4">
        <ItemDescriptionField {...props} />
        <ItemPriorityRankField {...props} />
      </div>
      <ItemClassificationColumn {...props} />
    </div>
  );
}
