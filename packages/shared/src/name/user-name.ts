/**
 * Structured ФИО (surname / first name / patronymic) helpers.
 *
 * `name` stays the stored, denormalized display value; these helpers recompute
 * it from the parts on write and derive the short form + avatar initials.
 *
 * Order is surname-first (ФИО): [lastName, firstName, middleName].
 */

export interface UserNameParts {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}

/**
 * First non-whitespace character of a part (Cyrillic-safe), or "".
 * @param part raw name part (may be null/undefined/whitespace)
 * @returns the first character, or "" when the part is empty
 */
function firstLetter(part?: string | null): string {
  const trimmed = (part ?? "").trim();
  return trimmed ? trimmed[0] : "";
}

/**
 * Canonical display name: surname-first, single-spaced, absent patronymic
 * omitted. e.g. "Петров Алексей Иванович" / "Петров Алексей".
 * @param parts structured ФИО parts
 * @returns the composed display name
 */
export function composeName(parts: UserNameParts): string {
  return [parts.lastName, parts.firstName, parts.middleName]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Short form: surname + given/patronymic initials, e.g. "Берёзов А.В." or
 * "Берёзов А." when there is no patronymic.
 * @param parts structured ФИО parts
 * @returns the short display form
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
 * Avatar initials from a plain name string: first + second whitespace token
 * under the surname-first order (NOT first + last), e.g.
 * "Берёзов Александр Владимирович" → "БА". A single token yields its first
 * two letters. This is the fallback for part-less records (SAML stubs).
 * @param name a plain display name string
 * @returns up to two uppercase initials
 */
export function initialsFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${firstLetter(tokens[0])}${firstLetter(tokens[1])}`.toUpperCase();
}

/**
 * Short display form from a plain name string: surname plus the dotted initials
 * of every following token, under the surname-first order. e.g.
 * "Иванов Василий Петрович" → "Иванов В.П."; "Каштанова Мария" → "Каштанова М.".
 * A single token returns just that token; an empty string returns "". Use this
 * everywhere a name is rendered as a text label (stage owners, slide owners,
 * cross-author authors) — the full ФИО stays only in the top user badge, and the
 * compact 2-letter form ({@link initialsFromName}) stays for round avatar chips.
 * @param name a plain surname-first display name string
 * @returns the short "Surname I.O." form
 */
export function shortNameFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const [surname, ...rest] = tokens;
  if (rest.length === 0) return surname;
  const initials = rest
    .map((token) => `${firstLetter(token).toUpperCase()}.`)
    .join("");
  return `${surname} ${initials}`;
}

/**
 * Avatar initials, preferring structured parts (surname-initial +
 * given-initial → "БА"). Falls back to the name-string heuristic when the
 * parts are absent — the common SAML-stub case where only `name` is set.
 * @param input optional structured parts plus a fallback `name`
 * @param input.lastName surname (preferred first initial)
 * @param input.firstName given name (preferred second initial)
 * @param input.name fallback display name when the parts are absent
 * @returns up to two uppercase initials
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
