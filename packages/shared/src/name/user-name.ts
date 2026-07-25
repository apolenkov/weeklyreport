/**
 * Structured ФИО helpers (surname-first); denormalized `name` recomputed on write.
 * See `structured-user-name` / `user-name-display`.
 */

/** Surname-first ФИО parts: lastName, firstName, optional middleName (patronymic). */
export interface UserNameParts {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}

function firstLetter(part?: string | null): string {
  const trimmed = (part ?? "").trim();
  return trimmed[0] ?? "";
}

/**
 * Canonical display name: surname-first, single-spaced; omit absent patronymic.
 * e.g. "Петров Алексей Иванович" / "Петров Алексей".
 * @param parts - The parts argument.
 */
export function composeName(parts: UserNameParts): string {
  return [parts.lastName, parts.firstName, parts.middleName]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Short form: surname + given/patronymic initials, e.g. "Баленков А.В."
 * or "Баленков А." when there is no patronymic.
 * @param parts - The parts argument.
 */
export function shortName(parts: UserNameParts): string {
  const surname = parts.lastName.trim();
  const initials = [parts.firstName, parts.middleName]
    .map(firstLetter)
    .filter((letter) => letter.length > 0)
    .map((letter) => `${letter.toUpperCase()}.`)
    .join("");
  return initials ? `${surname} ${initials}` : surname;
}

/**
 * Avatar initials from a plain name: first + second token (surname-first),
 * not first+last. Single token → first two letters. Fallback for SAML stubs.
 * @param name - The name argument.
 */
export function initialsFromName(name: string): string {
  const [first, second] = name.trim().split(/\s+/).filter(Boolean);
  if (first === undefined) return "";
  if (second === undefined) return first.slice(0, 2).toUpperCase();
  return `${firstLetter(first)}${firstLetter(second)}`.toUpperCase();
}

/**
 * Short "Surname I.O." from a plain surname-first name string.
 * Surface usage: see `user-name-display`.
 * @param name - The name argument.
 */
export function shortNameFromName(name: string): string {
  const [surname, ...rest] = name.trim().split(/\s+/).filter(Boolean);
  if (surname === undefined) return "";
  if (rest.length === 0) return surname;
  const initials = rest
    .map((token) => `${firstLetter(token).toUpperCase()}.`)
    .join("");
  return `${surname} ${initials}`;
}

/**
 * Avatar initials preferring structured parts; fall back to name-string
 * heuristic when parts are absent (SAML-stub case).
 * @param input - The input argument.
 */
export function initials(input: {
  lastName?: string | null;
  firstName?: string | null;
  name?: string | null;
}): string {
  const fromParts =
    `${firstLetter(input.lastName)}${firstLetter(input.firstName)}`.toUpperCase();
  if (fromParts) return fromParts;
  return initialsFromName(input.name ?? "");
}
