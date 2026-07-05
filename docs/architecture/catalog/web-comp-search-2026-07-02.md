# Catalog — web-comp-search (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                            | Layer     | Domain    | Purpose                                                                                                                                                                                                                       | Key exports | Deps                                                                               |
| ----------------------------------------------- | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| apps/web/src/components/search/search-input.tsx | component | shared-ui | Client full-text search combobox mounted in lead/head/admin/viewer surfaces; debounces query, fetches via tRPC search.query, renders keyboard-navigable results dropdown with highlighted snippets and role-aware deep links. | SearchInput | useTRPC, useSession, @tanstack/react-query, next/navigation router, SearchHit type |
