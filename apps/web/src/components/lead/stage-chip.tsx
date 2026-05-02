'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useSdlcTooltip } from '../ui/sdlc-tooltip';
import type { StageAssignment, StageStatus } from './mock-data';

type StageChipProps = {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
  /**
   * Number of risks currently associated with this stage (within the stage's
   * product). Surfaces as a confirmation prompt when the user picks "Clear"
   * — clearing a stage implicitly orphans those risks, so we ask first.
   */
  readonly linkedRiskCount?: number;
};

const STATUS_CONFIG: Record<
  StageStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  'on-track': {
    icon: '✓',
    bg: 'var(--color-success)',
    text: 'var(--color-primary)',
    border: 'var(--color-starbucks-accent)',
  },
  'at-risk': {
    icon: '!',
    bg: '#fef3c7',
    text: '#8a6d1b',
    border: '#d4a017',
  },
  blocked: {
    icon: '✕',
    bg: '#fee2e2',
    text: 'var(--color-destructive)',
    border: 'var(--color-destructive)',
  },
  empty: {
    icon: '○',
    bg: '#f8f6f2',
    text: 'var(--color-muted-foreground)',
    border: 'rgba(0,0,0,0.15)',
  },
};

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: 'on-track', label: '✓ On Track' },
  { value: 'at-risk', label: '! At Risk' },
  { value: 'blocked', label: '✕ Blocked' },
  { value: 'empty', label: '○ Clear' },
];

export function StageChip({ stage, onStatusChange, readOnly = false, linkedRiskCount = 0 }: StageChipProps) {
  const [showPopover, setShowPopover] = useState(false);
  // Pending status mirrors the radio-style chip selection inside the
  // popover. Earlier the dropdown applied on click; the redesign defers
  // until the user presses Save so a stray click doesn't clobber the
  // SDLC pipeline.
  const [pending, setPending] = useState<StageStatus>(stage.status);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const tooltip = useSdlcTooltip();
  const config = STATUS_CONFIG[stage.status];
  const isEditable = stage.ownership === 'mine' && !readOnly;
  const isLocked = stage.ownership === 'locked';
  const isUnassigned = stage.ownership === 'unassigned';
  const isEmpty = stage.status === 'empty' && isEditable;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const chipContains = dropdownRef.current?.contains(target);
      const portalContains = portalRef.current?.contains(target);
      if (!chipContains && !portalContains) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  // Position popover via portal to escape accordion overflow:hidden.
  useEffect(() => {
    if (!showPopover) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setPopoverPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showPopover]);

  const chipClasses = [
    'w-full p-2 rounded-lg text-center text-xs font-semibold transition-all duration-150',
    isEditable && !isEmpty
      ? 'cursor-pointer hover:opacity-80 hover:saturate-50 hover:shadow-[0_0_0_2.5px_rgba(0,0,0,0.12)]'
      : '',
    isEmpty
      ? 'cursor-pointer border-dashed animate-[sdlc-pulse_3s_infinite] hover:animate-none hover:shadow-[0_0_0_2px_rgba(0,117,74,0.2)]'
      : '',
    isLocked ? 'opacity-35 cursor-not-allowed grayscale-[0.5]' : '',
    isUnassigned ? 'cursor-not-allowed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const borderStyle = isEmpty && isEditable
    ? `1.5px dashed var(--color-starbucks-accent)`
    : isUnassigned
      ? '1.5px dashed rgba(0,0,0,0.15)'
      : `1.5px solid ${config.border}`;

  function handleChipClick() {
    if (!isEditable) return;
    setPending(stage.status); // Reset selection to current every time popover opens.
    setShowPopover(!showPopover);
  }

  function handleSave() {
    if (!isEditable) return;
    if (pending !== stage.status) {
      // Confirm before clearing a stage that has linked risks — clearing
      // doesn't delete the risks themselves, but removing the stage's
      // status drops the chip-level signal that surfaces those risks
      // visually, so warn the user before cutting that thread.
      if (pending === 'empty' && linkedRiskCount > 0) {
        const ok = window.confirm(
          `Clear "${stage.stageName}"? It still has ${linkedRiskCount} linked risk${linkedRiskCount === 1 ? '' : 's'}.\n\nThe risks themselves stay; only the stage's status changes back to undefined.`,
        );
        if (!ok) return;
      }
      onStatusChange?.(stage.stageName, pending);
    }
    setShowPopover(false);
  }

  function handleCancel() {
    setShowPopover(false);
  }

  const title = isLocked
    ? `${stage.assignee ?? 'Unknown'} · No edit permissions`
    : isUnassigned
      ? 'Unassigned · Contact admin'
      : stage.tooltip ?? `${stage.stageName} · ${stage.status}`;

  function handleEnter() {
    const el = buttonRef.current;
    if (!el) return;
    tooltip.show(el.getBoundingClientRect(), title);
  }

  function handleLeave() {
    tooltip.hide();
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-[90px]" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className={chipClasses}
        style={{
          background: config.bg,
          color: config.text,
          border: borderStyle,
        }}
        aria-label={`${stage.stageName}: ${stage.status}`}
        onClick={handleChipClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        disabled={!isEditable}
        tabIndex={isEditable ? 0 : -1}
      >
        {config.icon} {stage.stageName}
      </button>

      {/* Assignee label */}
      <span
        className="text-[11px]"
        style={{
          color: stage.ownership === 'mine'
            ? 'var(--color-starbucks-accent)'
            : 'var(--color-muted-foreground)',
          fontWeight: stage.ownership === 'mine' ? 600 : 400,
        }}
      >
        {isUnassigned ? '— unassigned' : stage.assignee}
      </span>

      {/* Status popover form (M2 redesign). Portaled to body to escape
          accordion overflow:hidden. Selection is staged in `pending` and
          applied only on Save. */}
      {showPopover && popoverPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-50 w-[260px] rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-lg"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            role="dialog"
            aria-label={`Set status for ${stage.stageName}`}
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
              {stage.stageName}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const cfg = STATUS_CONFIG[opt.value];
                const selected = pending === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPending(opt.value)}
                    className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-[12px] font-semibold transition-all"
                    style={{
                      background: selected ? cfg.bg : 'transparent',
                      color: selected ? cfg.text : 'var(--color-foreground)',
                      border: `1.5px solid ${selected ? cfg.border : 'rgba(0,0,0,0.15)'}`,
                    }}
                    aria-pressed={selected}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-press inline-flex min-h-[32px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.15)] bg-transparent px-3 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending === stage.status}
                className="btn-press inline-flex min-h-[32px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>,
          document.body,
        )
      }
    </div>
  );
}
