/** Rechecks the live select and preserves the assignment policy immediately before dispatch. */
export const SELECT_ASSIGNMENT = `(el, item, mode) => {
  if (!(el instanceof HTMLSelectElement)) return {reason: 'select changed native type'};
  if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return {reason: 'select is disabled'};
  const available = Array.from(el.options).filter((option) => !option.matches(':disabled'));
  const planned = available.find((option) => option.value === item.alternative);
  if (!planned) return {reason: 'planned option is unavailable'};
  if (planned.value !== el.value) return {value: planned.value};
  if (mode === 'full') return {reason: 'planned assignment is already current'};
  const other = available.find((option) => option.value !== el.value);
  return other ? {value: other.value} : {reason: 'no alternative option is available'};
}`;
