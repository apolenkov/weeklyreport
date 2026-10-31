// Layout classes shared by the loaded lead toolbar and its loading skeleton, so
// the skeleton keeps the same row, wrap points and cluster widths as the page.
// Wrapping below lg lives here: the period cluster and the controls each take a
// full row, and the controls row only shares a line with the period from lg up.
export const LEAD_TOOLBAR_ROW_CLASS =
  "flex min-w-0 basis-full flex-wrap items-center gap-1.5 lg:flex-nowrap";

export const LEAD_TOOLBAR_PERIOD_SLOT_CLASS =
  "flex min-w-0 basis-full items-center lg:basis-auto lg:shrink-0";

export const LEAD_TOOLBAR_PERIOD_CLUSTER_CLASS =
  "flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 lg:flex-none";

export const LEAD_TOOLBAR_CONTROLS_SLOT_CLASS =
  "flex min-w-0 basis-full flex-wrap items-center gap-1.5 lg:ml-auto lg:basis-0 lg:grow lg:justify-end";
