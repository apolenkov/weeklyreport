const ACTION_ICON_COMMON_PROPS = {
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
} as const;

export function PlusIcon() {
  return (
    <svg {...ACTION_ICON_COMMON_PROPS} className="h-4 w-4">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

interface ActionIconProps {
  readonly className?: string;
}

// Canonical action icons — the only Edit/Delete/Check implementations in the
// app; feature slices size them, never re-draw them.
export function EditIcon({ className = "h-4 w-4" }: ActionIconProps) {
  return (
    <svg {...ACTION_ICON_COMMON_PROPS} className={className}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function DeleteIcon({ className = "h-4 w-4" }: ActionIconProps) {
  return (
    <svg {...ACTION_ICON_COMMON_PROPS} className={className}>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function CheckIcon({
  className = "h-4 w-4",
  strokeWidth = ACTION_ICON_COMMON_PROPS.strokeWidth,
}: ActionIconProps & { readonly strokeWidth?: number }) {
  return (
    <svg
      {...ACTION_ICON_COMMON_PROPS}
      className={className}
      strokeWidth={strokeWidth}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
