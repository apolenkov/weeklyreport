type RequiredProperties<T extends object> = {
  [Key in keyof T as undefined extends T[Key] ? never : Key]: T[Key];
};

type OptionalDefinedProperties<T extends object> = {
  [Key in keyof T as undefined extends T[Key] ? Key : never]?: Exclude<
    T[Key],
    undefined
  >;
};

/** Object shape with explicit `undefined` removed from optional values. */
export type WithoutUndefinedProperties<T extends object> =
  RequiredProperties<T> & OptionalDefinedProperties<T>;

/**
 * Converts protocol objects whose optional keys may explicitly contain
 * `undefined` into domain objects where those keys are genuinely absent.
 */
export function omitUndefinedProperties<T extends object>(
  value: T,
): WithoutUndefinedProperties<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as WithoutUndefinedProperties<T>;
}
