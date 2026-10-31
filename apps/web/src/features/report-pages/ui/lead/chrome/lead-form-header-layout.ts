// Header layout classes shared by the loaded lead header and its loading
// skeleton, with no hooks so both can import them.
export const LEAD_HEADER_ROW_CLASS =
  "relative flex flex-wrap items-start justify-between gap-4";

export const LEAD_HEADER_TITLE_CLASS =
  "flex min-w-0 flex-wrap items-center gap-3";

// The loaded header moves its action group onto its own row below the title
// at 985px and narrower (measured at 980 wrapped and 990 single-row, in both
// edit and slides modes, with the disabled-reason line shown). The skeleton
// applies it so its action placeholders wrap at the same widths.
export const LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS = "max-[985px]:basis-full";
