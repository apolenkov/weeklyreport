"use client";

import {
  CheckIcon as SharedCheckIcon,
  DeleteIcon as SharedDeleteIcon,
  EditIcon as SharedEditIcon,
} from "../../../shared/ui/icons/action-icons";

// Row buttons are compact: size the canonical shared icons down to h-3.
export function EditIcon() {
  return <SharedEditIcon className="h-3 w-3" />;
}

export function DeleteIcon() {
  return <SharedDeleteIcon className="h-3 w-3" />;
}

export function CheckIcon() {
  return <SharedCheckIcon className="h-3 w-3" />;
}

export function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}
