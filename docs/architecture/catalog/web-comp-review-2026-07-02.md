# Catalog — web-comp-review (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                                   | Layer     | Domain | Purpose                                                                                                                                                           | Key exports       | Deps                                          |
| ------------------------------------------------------ | --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| apps/web/src/components/review/review-comment-list.tsx | component | review | Display-only list of a record's reviewer comments (name, date, text), shared across head/viewer accordions and lead cards; optional per-comment action injection. | ReviewCommentList | RecordCommentView type (@customreport/shared) |
