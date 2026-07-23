"use client";

import type { ChipChoice } from "../../../shared/ui/choice-chip-row";
import { RecordTextareaField } from "../../../shared/ui/record-textarea-field";
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

interface ItemEditDialogFieldsProps {
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
  readonly stageIds: string[];
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

/**
 * The item dialog's two-column form body: description + priority rank on the
 * left, the Product/Stages/Status classification panel on the right.
 * unify-record-dialogs: mirrors the risk dialog's layout.
 */
export function ItemEditDialogFields({
  text,
  onTextChange,
  textError,
  priorityRank,
  onPriorityRankChange,
  rankOptions,
  takenRanks,
  week,
  parent,
  products,
  activities,
  onParentChange,
  isActivityParent,
  stageIds,
  availableStages,
  isDeadEnd,
  stageError,
  parentName,
  onStageChange,
  statusSlot,
  choices,
  status,
  onStatusSelect,
  pausedReason,
  pausedReasonError,
  onPausedReasonChange,
}: ItemEditDialogFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
      {/* Left column: description + priority rank. */}
      <div className="flex flex-1 flex-col gap-4">
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
          // eslint-disable-next-line jsx-a11y/no-autofocus -- forwarded to RecordTextareaField, which owns the actual DOM autofocus and its own justification
          autoFocus
        />

        {/* Priority rank — optional; set to mark this item as a top priority */}
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
            className="select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
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
      </div>

      {/* Right column: CLASSIFICATION panel — Product, Stages, Status. */}
      <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
          Classification
        </span>

        {/* Parent picker — shared component. Offers products and the
            author's attached activities; choosing an activity hides the
            stage step below. */}
        <ParentPicker
          id="item-product"
          value={parent}
          products={products}
          activities={activities}
          onChange={onParentChange}
        />

        {/* activity-first-class: the stage step is product-only. An activity
            owns no SDLC stage, so it is omitted for an activity parent. */}
        {!isActivityParent && (
          <StageStep
            id="item-stage"
            stageIds={stageIds}
            availableStages={availableStages}
            isDeadEnd={isDeadEnd}
            error={stageError}
            deadEndNotice={`No stages assigned on ${parentName} — contact admin.`}
            onChange={onStageChange}
          />
        )}

        <StatusSlotView
          slot={statusSlot}
          choices={choices}
          status={status}
          onSelect={onStatusSelect}
        />

        {/* require-paused-item-reason: a Paused item must explain why. */}
        {status === "paused" && (
          <PausedReasonField
            value={pausedReason}
            error={pausedReasonError}
            onChange={onPausedReasonChange}
          />
        )}
      </div>
    </div>
  );
}
