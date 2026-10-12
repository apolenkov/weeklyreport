import {
  initials as sharedInitials,
  initialsFromName as sharedInitialsFromName,
} from "@weeklyreport/shared";

// Avatar initials via the canonical shared helper (surname-first ФИО). The web
// surfaces render "??" for an empty name, so that placeholder decision lives
// here once rather than beside every avatar mapper.
export function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
}

export function initialsFromParts(
  input: Parameters<typeof sharedInitials>[0],
): string {
  return sharedInitials(input) || "??";
}
