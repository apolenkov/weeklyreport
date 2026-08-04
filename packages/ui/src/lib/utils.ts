import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names with last-conflicting Tailwind utility precedence. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
