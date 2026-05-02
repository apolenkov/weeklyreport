'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useSdlcTooltip } from '../ui/sdlc-tooltip';
import type { StageAssignment, StageStatus } from './mock-data';

type StageChipProps = {
  readonly stage: StageAssignment;
  readonly onStatusChange?: (stageName: string, newStatus: StageStatus) => void;
  readonly readOnly?: boolean;
};

const STATUS_CONFIG: Record<
  StageStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  'on-track': {
    icon: '\u2713',
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
    icon: '\u2715',
    bg: '#fee2e2',
    text: 'var(--color-destructive)',
    border: 'var(--color-destructive)',
  },
  empty: {
    icon: '\u25CB',
    bg: '#f8f6f2',
    text: 'var(--color-muted-foreground)',
    border: 'rgba(0,0,0,0.15)',
  },
};

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: 'on-track', label: '\u2713 On Track' },
  { value: 'at-risk', label: '! At Risk' },
  { value: 'blocked', label: '\u2715 Blocked' },
  { value: 'empty', label: '\u25CB Clear' },
];

export function StageChip({ stage, onStatusChange, readOnly = false }: StageChipProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
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
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // The chip lives inside an accordion with overflow:hidden, so an absolutely
  // positioned dropdown gets clipped (only the first option shows). Render it
  // through a portal to <body> and position it via the button's getBoundingClientRect
  // so it floats above any clipping ancestor.
  useEffect(() => {
    if (!showDropdown) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setDropdownPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDropdown]);

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
    setShowDropdown(!showDropdown);
  }

  function handleStatusSelect(newStatus: StageStatus) {
    onStatusChange?.(stage.stageName, newStatus);
    setShowDropdown(false);
  }

  const title = isLocked
    ? `${stage.assignee ?? 'Unknown'} \u00b7 No edit permissions`
    : isUnassigned
      ? 'Unassigned \u00b7 Contact admin'
      : stage.tooltip ?? `${stage.stageName} \u00b7 ${stage.status}`;

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
        {isUnassigned ? '\u2014 unassigned' : stage.assignee}
      </span>

      {/* Status dropdown — portaled to body so the surrounding accordion's
          overflow:hidden does not clip it. */}
      {showDropdown && dropdownPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-50 rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-lg"
            style={{ top: dropdownPos.top, left: dropdownPos.left, minWidth: '140px' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f8f6f2]"
                style={{
                  color: STATUS_CONFIG[opt.value].text,
                  background: stage.status === opt.value ? STATUS_CONFIG[opt.value].bg : undefined,
                }}
                onClick={() => handleStatusSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      }
    </div>
  );
}
