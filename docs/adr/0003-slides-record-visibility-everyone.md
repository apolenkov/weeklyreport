# Lead slides support Mine and Everyone visibility

**Status:** accepted and implemented.

In **Mine** mode, a lead's slides contain the lead's own records. In
**Everyone** mode, the lead's own deck also includes co-owner items, risks, and
decisions for shared products. The mode affects only the slide projection; it
never changes drafts, submissions, published snapshots, or exports.

The projection is built by `mergeForeignSlideContent` and does not mutate the
cached report section. Everyone mode is available only on the lead's own deck;
foreign decks remain Mine-only. Foreign rows use the same counting rules as
owned rows, but do not participate in priority ranking.
