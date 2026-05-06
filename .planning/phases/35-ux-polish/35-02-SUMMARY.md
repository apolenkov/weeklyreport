---
phase: 35-ux-polish
plan: 02
status: subsumed
closed: 2026-05-06
requirements: [UX-14]
subsumed_by: 35-08
files_modified: []
---

<outcome>
HIST-2 Quick Filters (All / Submitted / Drafts pill row) — superseded by 35-08 `/reports` tabbed page.

35-08 merged `/lead/history` + `/reports/history` into single `/reports` route with two tabs: "Мои черновики" (drafts) and "Опубликованные" (submitted/published). Role-default selects starting tab. Both legacy routes 307-redirect to `/reports?tab=…`.

Effect on UX-14:

- "All" filter — equivalent to switching between both tabs (each shows its full role-scoped set).
- "Submitted" — `/reports?tab=published`.
- "Drafts" — `/reports?tab=drafts`.

The user value (filter old reports by status) is delivered via the same backend query path; the chip-row UI was replaced with tab switcher per the visual review feedback "лишние chips на /lead/history — путаница с архивом".
</outcome>

<verification>
Manual: open `/lead/history` while logged in as lead → 307 → `/reports?tab=drafts`. Click "Опубликованные" tab → URL becomes `/reports?tab=published`. Same flow for head/admin lands on `/reports?tab=published` first.

No standalone HIST-2 sidebar implementation shipped. UX-14 closed via 35-08 path.
</verification>
