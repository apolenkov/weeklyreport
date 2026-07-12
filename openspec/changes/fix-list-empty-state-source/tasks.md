## 1. Reopen Requests tab (`reopen-tab.tsx`)

- [ ] 1.1 Replace the empty-state gate at line 132
      (`!listQuery.isPending && !listQuery.isError && requests.length === 0`)
      with a check against `filteredRequests.length === 0`, keeping the
      pending/error guards unchanged
- [ ] 1.2 Add a "no results for the search" branch: when
      `requests.length > 0 && filteredRequests.length === 0`, render a
      message naming the empty search result (e.g. "No requests match the
      search.") instead of falling through to the existing "No pending reopen
      requests." / "Nothing here yet." copy, which stays for the true
      `requests.length === 0` case
- [ ] 1.3 Change the `TabHeader` `count` prop (line 90) from
      `` `${requests.length} requests` `` to
      `` `${filteredRequests.length} requests` ``

## 2. Action Log tab (`action-log-tab.tsx`)

- [ ] 2.1 Change the header count badge (line 82) from
      `` `${rows.length} loaded...` `` to
      `` `${visibleRows.length} loaded...` ``
- [ ] 2.2 Change the empty-state message chooser (line 113) from
      `rows.length === 0 ? "No actions recorded yet." : "No actions match the
search."` to branch on `visibleRows.length === 0 && rows.length === 0`
      (no data at all) vs. `visibleRows.length === 0 && rows.length > 0` (all
      rows hidden by the proof-row filter and/or the search), keeping the
      existing `visibleRows.length === 0` outer gate unchanged

## 3. Verification

- [ ] 3.1 Manual check: open `/admin?tab=reopen`, type a search that matches
      nothing — header count drops to 0 and an explicit "no match" message
      renders instead of a blank panel under a stale count
- [ ] 3.2 Manual check: open `/admin?tab=action-log` with only proof rows on
      the page and no search typed — the count badge reads 0 and the message
      reads "No actions recorded yet." style copy, not "No actions match the
      search."
- [ ] 3.3 `pnpm --filter @customreport/web typecheck`
- [ ] 3.4 `pnpm --filter @customreport/web lint`
- [ ] 3.5 `pnpm --filter @customreport/web test`
- [ ] 3.6 `npx openspec validate fix-list-empty-state-source --strict`
