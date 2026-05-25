# Tasks

- [ ] T1: Update `RemindLeadButton.tsx` — add hidden `<div>` with
      `aria-live="polite" aria-atomic="true"` below the button
- [ ] T2: Add state management — track reminder status (idle / sending /
      sent / error) in the component
- [ ] T3: On successful send, render announcement text: "Reminder email sent to
      [lead name]"
- [ ] T4: On error, render: "Failed to send reminder. Please try again."
- [ ] T5: Clear the message after 5 seconds
- [ ] T6: Add test cases asserting aria-live content changes on success/error
- [ ] T7: Commit — `feat(remind-button): add aria-live announcements for
    accessibility`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test`; test
      with a screen reader in dev UI
