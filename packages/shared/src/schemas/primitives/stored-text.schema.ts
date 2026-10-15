import { z } from "zod";

// Reads return persisted report text exactly as stored. Author write rules may
// tighten over time, so read models never re-validate text against them. An
// empty string was never admitted by any writer and PostgreSQL text cannot
// hold a null byte, so either still fails closed as malformed data.
/** Persisted report text, accepted as stored. */
export const storedText = () =>
  z
    .string()
    .min(1)
    .refine((value) => !value.includes("\u0000"), {
      message: "Text must not contain null bytes",
    });

/** Persisted stage names on a read model, accepted as stored. */
export const storedStageNamesField = z.array(storedText()).readonly();
