import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with clsx + tailwind-merge (last conflicting utility wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
