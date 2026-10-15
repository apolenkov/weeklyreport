import { z } from "zod";

// Reads return persisted report text exactly as stored. Author write rules may
// tighten over time, so read models never re-validate text against them; an
// empty string was never admitted by any writer and still fails closed.
/** Persisted report text, accepted as stored. */
export const storedText = () => z.string().min(1);

/** Persisted stage names on a read model, accepted as stored. */
export const storedStageNamesField = z.array(storedText()).readonly();
