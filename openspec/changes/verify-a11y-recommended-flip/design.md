# Regression-Test Catalog — Biome Recommended-Flip a11y Changes

Derived BY LOGIC (workflow `a11y-regression-catalog`, 58 agents) from the actual diff of each changed file against pre-flip `3b2785c2`, at the granularity the request asked for: **per file → per code block → DOM-model assertion → interaction**. This is the description of what regression coverage is _possible_; it is not yet implemented test code (see `tasks.md` for the run/implement plan).

> **Suppression-form note (post `migrate-lint-to-eslint-prettier` Phase 1):** the per-file descriptions below say "_Added biome-ignore …_" because they record each file's diff as it was at flip commit `c4610797`, when Biome was the linter. Those comments were converted 1:1 to `eslint-disable-next-line` form when Biome was removed (`noStaticElementInteractions → jsx-a11y/no-static-element-interactions`, `useKeyWithClickEvents → jsx-a11y/click-events-have-key-events`, `noAutofocus → jsx-a11y/no-autofocus`; the 6 `useSemanticElements` sites were dropped — no ESLint equivalent). The historical descriptions are left verbatim as an accurate diff record. **The regression target is runtime behavior (Escape-closability, focus, ARIA attributes), which is tool-independent — the comment form is incidental.** Any catalog row that asserted "renders without Biome linting error" should assert the DOM attribute it implies, not the lint tool.

## Summary

- **480 regression tests** across **58 files**.
- By type: 418 unit-rtl · 6 playwright-e2e · 56 snapshot.
- By priority: 266 high · 183 medium · 31 low.
- 27 files already have a colocated test file (extend, don't recreate).
- Type legend: `unit-rtl` = React Testing Library render+assert; `snapshot` = DOM snapshot; `playwright-e2e` = needs a live browser + role login.

## Behavior + security files (sonnet-derived)

### `apps/web/src/app/layout.tsx`

_Added biome-ignore lint/security/noDangerouslySetInnerHtml suppression comment above a pre-existing dangerouslySetInnerHTML on the script#\_\_org_data element; no runtime DOM behavior changed_  
Existing test: —

| Block                                                                                    | DOM assertion                                                                                                                                                                                                                                          | Interaction | Type           | Pri    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------- | ------ |
| script#\_\_org_data dangerouslySetInnerHTML — type attribute                             | script element has type="application/json" (inert, non-executing), ensuring the dangerouslySetInnerHTML payload is never evaluated as JavaScript                                                                                                       | —           | unit-rtl       | high   |
| script#\_\_org_data dangerouslySetInnerHTML — serialized payload                         | script element's \_\_html prop equals JSON.stringify(orgPublic), i.e. JSON.parse(script.textContent) deep-equals the orgPublic value returned by getOrgPublic()                                                                                        | —           | unit-rtl       | high   |
| script#\_\_org_data dangerouslySetInnerHTML — element id                                 | script element has id="**org_data" so the client-side landing page can locate it via document.getElementById('**org_data')                                                                                                                             | —           | unit-rtl       | medium |
| script#\_\_org_data dangerouslySetInnerHTML — null orgPublic path                        | when getOrgPublic() resolves to null/undefined, JSON.stringify(null) = "null" is written to \_\_html and the script element still renders without throwing                                                                                             | —           | unit-rtl       | medium |
| script#\_\_org_data dangerouslySetInnerHTML — first-paint fidelity in real document head | script#**org_data is present in the document <head> before client-side hydration runs, and JSON.parse(document.getElementById('**org_data').textContent) returns a valid org object                                                                    | —           | playwright-e2e | medium |
| script#\_\_org_data dangerouslySetInnerHTML — trust-boundary documentation (latent)      | when orgPublic contains a string value with '</script>', JSON.stringify does not escape it and the raw tag-breakout sequence appears in the injected content — documents the 'trusted source' assumption load-bearing to the suppression justification | —           | unit-rtl       | low    |

### `apps/web/src/app/print/[reportId]/page.tsx`

_Added a biome-ignore suppression comment for lint/security/noDangerouslySetInnerHtml on the <style> element that injects static print CSS; no runtime behavior changed._  
Existing test: —

| Block                                                     | DOM assertion                                                                                                                                                       | Interaction | Type     | Pri    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| <style dangerouslySetInnerHTML> \_\_html template literal | the rendered <style> element's textContent contains only static CSS keywords (@media print, @page, body, nav, .no-print) and no user-supplied string interpolations | —           | unit-rtl | high   |
| <style dangerouslySetInnerHTML> \_\_html template literal | rendered <style> element's innerHTML does not contain any script-injectable patterns (angle brackets, javascript:, expression()) — confirming no XSS vector exists  | —           | unit-rtl | high   |
| <style dangerouslySetInnerHTML> \_\_html template literal | \_\_html value is identical on every render call regardless of reportId param — confirming it is not derived from props, query results, or any external input       | —           | unit-rtl | high   |
| <style dangerouslySetInnerHTML> element placement         | the <style> element is rendered as the first child of the fragment, before the <main> element, so print CSS is in the document before any content                   | —           | unit-rtl | medium |
| <style dangerouslySetInnerHTML> \_\_html template literal | rendered <style> element's textContent includes @media print and @page blocks — confirming the CSS injection path is live and not inadvertently stripped            | —           | unit-rtl | medium |
| <style dangerouslySetInnerHTML> snapshot                  | DOM snapshot of the <style> element matches the exact hardcoded CSS string — any future accidental interpolation of user data would break the snapshot              | —           | snapshot | medium |

### `apps/web/src/components/admin/groups-tab.tsx`

_Added two biome-ignore suppression comments on the dialog backdrop (noStaticElementInteractions) and inner dialog div (useKeyWithClickEvents), asserting keyboard-closability via Escape key and Cancel button as the justification for omitting keyboard handlers on those elements._  
Existing test: —

| Block                                                                                                          | DOM assertion                                                                                                                                           | Interaction                                                                                                                                                 | Type     | Pri    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| dialog backdrop onKeyDown — Escape closes dialog (useEffect keydown listener)                                  | after Escape keydown on document, element with data-testid="crud-sheet" is removed from the DOM                                                         | render with showDialog open → fireEvent.keyDown(document, { key: 'Escape' }) → assert dialog unmounted                                                      | unit-rtl | high   |
| Cancel button closes dialog                                                                                    | after clicking the Cancel button, element with data-testid="crud-sheet" is removed from the DOM                                                         | render with showDialog open → userEvent.click(getByRole('button', { name: /cancel/i })) → assert dialog unmounted                                           | unit-rtl | high   |
| dialog backdrop outer div — role="presentation" static attribute                                               | the outer backdrop div (data-testid="crud-sheet") has role="presentation"                                                                               | —                                                                                                                                                           | unit-rtl | high   |
| inner dialog div — role="dialog" + aria-modal attribute                                                        | inner div has role="dialog" and aria-modal="true"                                                                                                       | —                                                                                                                                                           | unit-rtl | high   |
| inner dialog div — aria-label reflects Add vs Edit mode                                                        | in add mode dialog has aria-label="Add group"; in edit mode dialog has aria-label="Edit group"                                                          | —                                                                                                                                                           | unit-rtl | medium |
| backdrop outer div onClick — clicking backdrop closes dialog                                                   | after clicking the backdrop div (data-testid="crud-sheet") directly, the dialog is removed from the DOM                                                 | render with showDialog open → userEvent.click(getByTestId('crud-sheet')) → assert dialog unmounted                                                          | unit-rtl | high   |
| inner dialog div onClick stopPropagation — clicking inside dialog does NOT close it                            | after clicking the inner role="dialog" element, data-testid="crud-sheet" remains in the DOM                                                             | render with showDialog open → userEvent.click(getByRole('dialog')) → assert dialog still mounted                                                            | unit-rtl | high   |
| dialog backdrop — no onKeyDown or onKeyUp handler on backdrop div (keyboard is handled at document level only) | the element with data-testid="crud-sheet" does not have onKeyDown or onKeyUp props (verify via DOM: no keydown listener attached to the element itself) | —                                                                                                                                                           | unit-rtl | medium |
| Escape keydown listener is cleaned up when dialog closes                                                       | after dialog closes, a subsequent Escape keydown on document does not throw and has no effect (no double-fire / stale listener)                         | render with showDialog open → fireEvent.keyDown(document, { key: 'Escape' }) → assert unmounted → fireEvent.keyDown(document, { key: 'Escape' }) → no error | unit-rtl | medium |
| Escape keydown listener is NOT active when dialog is closed (showDialog=false)                                 | when dialog is not shown, pressing Escape does not cause any state change or error                                                                      | render with showDialog closed (initial state) → fireEvent.keyDown(document, { key: 'Escape' }) → assert data-testid="crud-sheet" absent                     | unit-rtl | medium |
| dialog — Tab order is not stranded (focusable controls reachable inside dialog)                                | Tab from first focusable element inside role="dialog" reaches the Cancel button and Save button without leaving the dialog container                    | render with showDialog open → Tab through all focusable elements → assert Cancel and Save buttons are reachable                                             | unit-rtl | medium |
| backdrop outer div — no tabIndex attribute (not in tab order)                                                  | the element with data-testid="crud-sheet" does not have a tabIndex attribute (or tabIndex=-1 at most)                                                   | —                                                                                                                                                           | unit-rtl | low    |

### `apps/web/src/components/admin/periods-tab.tsx`

_Added Escape-key handler (useEffect/document keydown) to close the delete-confirmation dialog, plus biome-ignore suppression comments on both dialog backdrops (delete + create/edit) and on the ActionIconRow group div asserting keyboard-closability and correct ARIA role._  
Existing test: `apps/web/src/components/admin/periods-tab.test.tsx`

| Block                                                                                             | DOM assertion                                                                                                        | Interaction                                                                                                        | Type           | Pri    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------- | ------ |
| useEffect keydown handler — Escape closes delete dialog                                           | dialog with data-testid="periods-delete-dialog" is removed from the DOM after Escape is pressed                      | open delete dialog by clicking delete icon → fireEvent.keyDown(document, { key: 'Escape' }) → dialog unmounts      | unit-rtl       | high   |
| useEffect keydown handler — Escape event is prevented (no scroll/browser default)                 | e.preventDefault() is called when Escape is pressed while delete dialog is open                                      | open delete dialog → dispatch keydown Escape with a spy on preventDefault → assert preventDefault was called       | unit-rtl       | medium |
| useEffect keydown handler — non-Escape keys do not close delete dialog                            | dialog with data-testid="periods-delete-dialog" remains in the DOM after a non-Escape key is pressed                 | open delete dialog → fireEvent.keyDown(document, { key: 'Enter' }) → dialog still present                          | unit-rtl       | medium |
| useEffect keydown handler — listener is cleaned up when deleteConfirm is cleared                  | pressing Escape after dialog closes (deleteConfirm=null) does not throw and has no effect                            | open delete dialog → close via Cancel → fireEvent.keyDown(document, { key: 'Escape' }) → no error, dialog absent   | unit-rtl       | medium |
| useEffect keydown handler — listener is not registered when deleteConfirm is null (initial state) | pressing Escape before the delete dialog is opened has no visible effect on the DOM                                  | render tab (deleteConfirm=null) → fireEvent.keyDown(document, { key: 'Escape' }) → no dialog appears               | unit-rtl       | low    |
| delete dialog backdrop — noStaticElementInteractions biome-ignore (keyboard-closable claim)       | clicking the backdrop div (data-testid="periods-delete-dialog") closes the dialog (setDeleteConfirm(null))           | open delete dialog → userEvent.click on the backdrop element itself → dialog unmounts                              | unit-rtl       | high   |
| delete dialog Cancel button — also closes the dialog                                              | dialog with data-testid="periods-delete-dialog" is removed from the DOM after Cancel is clicked                      | open delete dialog → userEvent.click Cancel button → dialog unmounts                                               | unit-rtl       | high   |
| delete dialog inner div — useKeyWithClickEvents biome-ignore (propagation-stop claim)             | clicking inside the dialog panel (role="dialog") does not close the dialog (stopPropagation works)                   | open delete dialog → userEvent.click on the inner role="dialog" div → dialog remains mounted                       | unit-rtl       | high   |
| delete dialog — role and aria-modal attributes                                                    | inner div has role="dialog" and aria-modal="true" and aria-label="Delete period confirmation"                        | —                                                                                                                  | unit-rtl       | medium |
| delete dialog — Tab key does not strand focus outside dialog (focus stays inside while open)      | Tab from Cancel reaches Delete button and back without leaving the dialog                                            | open delete dialog → userEvent.tab() twice → focused element remains within the dialog panel                       | unit-rtl       | medium |
| create/edit dialog backdrop — noStaticElementInteractions biome-ignore (keyboard-closable claim)  | pressing Escape while the create dialog is open closes it (dialog with data-testid="periods-create-dialog" unmounts) | click New Period button → dialog opens → fireEvent.keyDown(document, { key: 'Escape' }) → dialog unmounts          | unit-rtl       | high   |
| create/edit dialog backdrop — clicking backdrop calls onCancel                                    | dialog with data-testid="periods-create-dialog" is removed from the DOM after backdrop click                         | open create dialog → userEvent.click the backdrop div → dialog unmounts                                            | unit-rtl       | high   |
| create/edit dialog inner div — useKeyWithClickEvents biome-ignore (propagation-stop claim)        | clicking inside the create dialog panel does not close the dialog                                                    | open create dialog → userEvent.click on the inner role="dialog" div → dialog remains mounted                       | unit-rtl       | high   |
| ActionIconRow container — useSemanticElements biome-ignore (role=group claim)                     | action icon container div has role="group" and aria-label matching "Actions for period <id>"                         | —                                                                                                                  | unit-rtl       | medium |
| ActionIconRow container — role=group is not a fieldset                                            | no <fieldset> element is rendered inside data-testid="action-icons-<id>"                                             | —                                                                                                                  | unit-rtl       | low    |
| delete dialog — Escape key closes dialog in a real browser with ARIA role=dialog focus trap       | dialog unmounts on Escape key in a live browser after admin login                                                    | navigate to admin periods tab → log in as admin → open delete confirmation → press Escape → confirm dialog is gone | playwright-e2e | low    |

### `apps/web/src/components/admin/products-tab.tsx`

_Added two biome-ignore suppressions on the Add/Edit dialog backdrop (noStaticElementInteractions) and inner div (useKeyWithClickEvents) with accessibility justification comments, and added aria-hidden="true" to PlusIcon and ChevronIcon SVGs_  
Existing test: —

| Block                                                                                                         | DOM assertion                                                                                                                | Interaction                                                                                                                                                                          | Type     | Pri    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| useEffect Escape listener (lines 46-56) — load-bearing assertion for biome-ignore noStaticElementInteractions | dialog element with role="dialog" is removed from DOM after Escape keydown on document                                       | render ProductsTab with showDialog open → fireEvent.keyDown(document, { key: 'Escape' }) → assert role="dialog" element is no longer in the document                                 | unit-rtl | high   |
| Cancel button (line 414-421) — second load-bearing assertion for biome-ignore noStaticElementInteractions     | dialog element with role="dialog" is removed from DOM after Cancel button click                                              | render ProductsTab with showDialog open → userEvent.click(getByRole('button', { name: 'Cancel' })) → assert role="dialog" element is no longer in the document                       | unit-rtl | high   |
| backdrop div onClick (line 362) — proves biome-ignore noStaticElementInteractions is justified                | dialog element with role="dialog" is removed from DOM after clicking the backdrop (role="presentation") div                  | render ProductsTab with showDialog open → userEvent.click(getByRole('presentation')) → assert role="dialog" element is no longer in the document                                     | unit-rtl | high   |
| inner dialog div stopPropagation (line 371) — load-bearing assertion for biome-ignore useKeyWithClickEvents   | dialog element with role="dialog" remains in the DOM after clicking inside the dialog content area                           | render ProductsTab with showDialog open → userEvent.click(getByRole('dialog')) → assert role="dialog" element is still present in the document                                       | unit-rtl | high   |
| dialog div (line 368-371) — static DOM structure implied by both biome-ignore suppressions                    | dialog container has role="dialog" and aria-modal="true"                                                                     | —                                                                                                                                                                                    | unit-rtl | medium |
| dialog div aria-label toggle (line 370)                                                                       | dialog has aria-label="Add product" when editingProduct is null, and aria-label="Edit product" when an editingProduct is set | —                                                                                                                                                                                    | unit-rtl | medium |
| backdrop div (line 360-364) — role attribute supporting noStaticElementInteractions suppression               | backdrop outer div has role="presentation"                                                                                   | —                                                                                                                                                                                    | unit-rtl | medium |
| Cancel button keyboard activation — Tab-order not stranded claim                                              | Cancel button is reachable by Tab and activatable by Enter/Space, closing the dialog                                         | render ProductsTab with showDialog open → Tab into dialog → Tab until Cancel button is focused → press Enter → assert role="dialog" is removed from DOM                              | unit-rtl | medium |
| PlusIcon SVG aria-hidden (line 459)                                                                           | svg rendered inside PlusIcon has aria-hidden="true"                                                                          | —                                                                                                                                                                                    | unit-rtl | medium |
| ChevronIcon SVG aria-hidden (line 477)                                                                        | svg rendered inside ChevronIcon has aria-hidden="true"                                                                       | —                                                                                                                                                                                    | unit-rtl | medium |
| Escape listener teardown — useEffect cleanup                                                                  | pressing Escape after dialog is closed does not throw and has no effect on the surrounding page                              | render ProductsTab with showDialog open → close dialog via Cancel → fireEvent.keyDown(document, { key: 'Escape' }) → assert no error thrown and ProductsTab root is still in the DOM | unit-rtl | low    |

### `apps/web/src/components/admin/users-tab.tsx`

_Three changes: (1) aria-label removed from inactive-user badge span (text content now carries the label); (2) two biome-ignore suppressions added to dialog backdrop (noStaticElementInteractions) and inner dialog div (useKeyWithClickEvents) with the load-bearing claim that the dialog is keyboard-closable via Escape and Cancel; (3) aria-hidden="true" added to PlusIcon SVG._  
Existing test: —

| Block                                                                                                            | DOM assertion                                                                                                                             | Interaction                                                                                                            | Type           | Pri    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| inactive badge span — aria-label removed                                                                         | span containing text 'inactive' does NOT have an aria-label attribute                                                                     | —                                                                                                                      | unit-rtl       | medium |
| inactive badge span — text content carries accessible name after aria-label removal                              | span with text 'inactive' is accessible by its text content (getByText('inactive') resolves without needing a role query)                 | —                                                                                                                      | unit-rtl       | medium |
| dialog backdrop biome-ignore noStaticElementInteractions — Escape closes dialog (keyboard-closable claim)        | after pressing Escape, element with data-testid='crud-sheet' is not in the document                                                       | open dialog via Add User button, then press Escape key (fireEvent.keyDown(document, { key: 'Escape' }))                | unit-rtl       | high   |
| dialog backdrop biome-ignore noStaticElementInteractions — Cancel button closes dialog (keyboard-closable claim) | after clicking Cancel button, element with data-testid='crud-sheet' is not in the document                                                | open dialog via Add User button, then click button with text 'Cancel'                                                  | unit-rtl       | high   |
| dialog inner div biome-ignore useKeyWithClickEvents — clicking backdrop closes dialog                            | after clicking the backdrop div (data-testid='crud-sheet'), dialog is removed from DOM                                                    | open dialog, fireEvent.click on element with data-testid='crud-sheet'                                                  | unit-rtl       | high   |
| dialog inner div biome-ignore useKeyWithClickEvents — clicking inside dialog does NOT close it (stopPropagation) | after clicking the role='dialog' element, data-testid='crud-sheet' remains in the document                                                | open dialog, fireEvent.click on element with role='dialog'                                                             | unit-rtl       | high   |
| dialog role and aria-modal — dialog has correct ARIA attributes                                                  | element with role='dialog' has aria-modal='true' and aria-label matching 'Add user' (when adding) or 'Edit user' (when editing)           | —                                                                                                                      | unit-rtl       | medium |
| dialog backdrop — backdrop has role='presentation' so screen readers do not announce it as interactive           | element with data-testid='crud-sheet' has role='presentation'                                                                             | —                                                                                                                      | unit-rtl       | medium |
| dialog keyboard-closable claim — Tab order is not stranded (focus stays within dialog while it is open)          | after opening dialog, Tab from the last focusable element does not escape to background content (focus remains within the dialog subtree) | open dialog, userEvent.tab() repeatedly until focus would leave dialog, assert focus stays inside role='dialog'        | playwright-e2e | high   |
| PlusIcon SVG — aria-hidden added                                                                                 | svg inside 'Add new user' button has aria-hidden='true'                                                                                   | —                                                                                                                      | unit-rtl       | medium |
| PlusIcon SVG — button accessible name does not rely on SVG after aria-hidden added                               | button with aria-label='Add new user' is found by role and label; its accessible name is 'Add new user' and not derived from SVG content  | —                                                                                                                      | unit-rtl       | medium |
| dialog Escape key listener — listener is removed when dialog closes (no stale listener)                          | after closing the dialog via Escape, firing a second Escape event does not cause an error or re-trigger state changes                     | open dialog, press Escape (dialog closes), press Escape again (nothing happens)                                        | unit-rtl       | medium |
| dialog Escape key listener — listener is only active when dialog is open                                         | pressing Escape before opening the dialog does not affect component state; dialog remains absent                                          | without opening dialog, fireEvent.keyDown(document, { key: 'Escape' }), then assert data-testid='crud-sheet' is absent | unit-rtl       | low    |

### `apps/web/src/components/lead/confirm-delete-dialog.tsx`

_Added two biome-ignore comments suppressing a11y/noStaticElementInteractions on the backdrop div and a11y/useKeyWithClickEvents on the inner dialog div; no behavior or DOM structure changed._  
Existing test: —

| Block                                                                            | DOM assertion                                                                                                                           | Interaction                                                                                                                                | Type     | Pri    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| document-level keydown handler — Escape branch                                   | onCancel callback is called when Escape is pressed while dialog is open                                                                 | render with open=true, fireEvent.keyDown(document, { key: 'Escape' }) → expect onCancel to have been called once                           | unit-rtl | high   |
| Cancel button onClick                                                            | onCancel callback is called when Cancel button is clicked                                                                               | render with open=true, fireEvent.click(screen.getByRole('button', { name: /cancel/i })) → expect onCancel called once                      | unit-rtl | high   |
| backdrop div onClick (role=presentation)                                         | onCancel callback is called when the backdrop overlay (role=presentation) is clicked                                                    | render with open=true, fireEvent.click(document.querySelector('[role="presentation"]')) → expect onCancel called once                      | unit-rtl | high   |
| inner dialog div onClick stopPropagation                                         | onCancel is NOT called when clicking anywhere inside the dialog container (stopPropagation prevents backdrop propagation)               | render with open=true, fireEvent.click(screen.getByRole('dialog')) → expect onCancel not called                                            | unit-rtl | high   |
| backdrop div role attribute                                                      | backdrop div has role="presentation"                                                                                                    | —                                                                                                                                          | unit-rtl | high   |
| inner dialog div ARIA attributes                                                 | inner container has role="dialog", aria-modal="true", aria-labelledby="confirm-delete-title", aria-describedby="confirm-delete-preview" | —                                                                                                                                          | unit-rtl | high   |
| autoFocus on confirm button via requestAnimationFrame                            | the destructive confirm button receives focus when the dialog opens (supports keyboard-closable / keyboard-operable claim)              | render with open=true, await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toHaveFocus())                          | unit-rtl | high   |
| document-level keydown handler — Enter branch when confirm button is focused     | onConfirm callback is called when Enter is pressed and the destructive button has focus                                                 | render with open=true, await focus to land on confirm button, fireEvent.keyDown(document, { key: 'Enter' }) → expect onConfirm called once | unit-rtl | medium |
| document-level keydown handler — Enter branch when confirm button is NOT focused | onConfirm is NOT called when Enter is pressed and focus is elsewhere (e.g. Cancel button focused)                                       | render with open=true, move focus to Cancel button, fireEvent.keyDown(document, { key: 'Enter' }) → expect onConfirm not called            | unit-rtl | medium |
| dialog not rendered when open=false                                              | no element with role="dialog" is present in the DOM when open is false                                                                  | —                                                                                                                                          | unit-rtl | medium |
| keydown listener cleanup when dialog closes                                      | onCancel is NOT called when Escape is pressed after dialog closes (listener removed on cleanup)                                         | render with open=true, rerender with open=false, fireEvent.keyDown(document, { key: 'Escape' }) → expect onCancel not called               | unit-rtl | medium |

### `apps/web/src/components/lead/decision-edit-dialog.tsx`

_Three biome-ignore suppressions added: noStaticElementInteractions on the backdrop div (claims keyboard-closable via Escape + Cancel), useKeyWithClickEvents on the inner dialog div (claims Escape bubbles to backdrop onKeyDown), and noAutofocus on the dec-text textarea (claims intentional initial focus)._  
Existing test: `apps/web/src/components/lead/decision-edit-dialog.test.tsx`

| Block                                                                                  | DOM assertion                                                                                           | Interaction                                                                                                                          | Type           | Pri    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------ |
| backdrop div onKeyDown — Escape closes dialog                                          | onCancel is called when Escape is pressed on the backdrop div (role="presentation")                     | render open dialog → fireEvent.keyDown on the backdrop div with key=Escape → expect onCancel called once                             | unit-rtl       | high   |
| backdrop div onKeyDown — Escape prevents default                                       | e.preventDefault() is called when Escape fires (no browser scroll/dismiss side-effect)                  | render open dialog → fireEvent.keyDown on backdrop with key=Escape and a spied preventDefault → expect preventDefault called         | unit-rtl       | medium |
| Cancel button onClick — keyboard-closable alternative to Escape                        | Cancel button has type="button" and clicking it calls onCancel                                          | render open dialog → fireEvent.click Cancel button → expect onCancel called once                                                     | unit-rtl       | high   |
| inner dialog div onClick stopPropagation — Escape still reaches backdrop               | pressing Escape while focus is inside the dialog div still calls onCancel (keydown bubbles to backdrop) | render open dialog → fireEvent.keyDown on the inner dialog div (role=dialog) with key=Escape → expect onCancel called once           | unit-rtl       | high   |
| inner dialog div onClick stopPropagation — click on dialog does not close              | clicking the inner dialog div (role=dialog) does not call onCancel (propagation stops)                  | render open dialog → fireEvent.click on the dialog div → expect onCancel not called                                                  | unit-rtl       | high   |
| backdrop div role=presentation — clicking backdrop closes dialog                       | clicking the backdrop div calls onCancel                                                                | render open dialog → fireEvent.click on the backdrop div (not on a child) → expect onCancel called once                              | unit-rtl       | high   |
| dec-text textarea autoFocus — initial focus lands on textarea                          | textarea#dec-text has the autoFocus attribute and receives focus on mount                               | render open dialog → expect document.activeElement to be the dec-text textarea                                                       | unit-rtl       | high   |
| dec-text textarea autoFocus — textarea has autoFocus attribute in DOM                  | textarea#dec-text has attribute autoFocus                                                               | —                                                                                                                                    | unit-rtl       | medium |
| backdrop div role=presentation — role attribute is present                             | outer backdrop div has role="presentation"                                                              | —                                                                                                                                    | unit-rtl       | medium |
| inner dialog div — role=dialog and aria-modal attributes                               | inner div has role="dialog" and aria-modal="true"                                                       | —                                                                                                                                    | unit-rtl       | medium |
| backdrop div onKeyDown — Cmd+Enter triggers save, not cancel                           | pressing Cmd+Enter (metaKey+Enter) on backdrop calls onSave, not onCancel                               | render open dialog with text/owner/impact filled → fireEvent.keyDown on backdrop with key=Enter, metaKey=true → expect onSave called | unit-rtl       | medium |
| backdrop div onKeyDown — non-Escape/Enter keys do not close dialog                     | pressing Tab or other keys on the backdrop does not call onCancel                                       | render open dialog → fireEvent.keyDown on backdrop with key=Tab → expect onCancel not called                                         | unit-rtl       | low    |
| keyboard navigation — Tab order is not stranded; focus reaches Cancel and Save buttons | Cancel and Save Decision buttons are reachable via Tab from the autoFocused textarea                    | render open dialog → userEvent.tab repeatedly from initial focus → expect Cancel and Save buttons each receive focus in sequence     | unit-rtl       | medium |
| Escape closes dialog in real browser with role-gated session                           | pressing Escape while the DecisionEditDialog is open unmounts the dialog from the DOM                   | log in as lead role → open decision dialog → press Escape → assert dialog element is gone from DOM                                   | playwright-e2e | low    |

### `apps/web/src/components/lead/item-edit-dialog.tsx`

_Three Biome a11y lint suppressions added with justification comments: noStaticElementInteractions on backdrop div (keyboard-closable claim), useKeyWithClickEvents on inner dialog div (propagation-stop claim), and noAutofocus on textarea (intentional modal focus claim)._  
Existing test: `apps/web/src/components/lead/item-edit-dialog.test.tsx`

| Block                                                                                                                   | DOM assertion                                                                                                                               | Interaction                                                                                                                                                | Type           | Pri    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| backdrop div onKeyDown — biome-ignore noStaticElementInteractions comment: 'dialog is keyboard-closable via Escape'     | onCancel callback is called when Escape is pressed anywhere within the backdrop                                                             | render open dialog, fireEvent.keyDown on the backdrop div with key='Escape' → onCancel is called once                                                      | unit-rtl       | high   |
| backdrop div onKeyDown — biome-ignore noStaticElementInteractions comment: 'keyboard-closable via … close button'       | Cancel button with role=button is present and calls onCancel when clicked                                                                   | render open dialog, click the Cancel button → onCancel fires                                                                                               | unit-rtl       | high   |
| backdrop div onKeyDown — Escape preventDefault and propagation                                                          | Escape keydown is handled on the backdrop container div (role=presentation), not swallowed silently, and fires before any outer handler     | attach a keyDown spy to a wrapper around the rendered dialog, press Escape → spy is NOT called (preventDefault + handled in dialog); verify onCancel fires | unit-rtl       | high   |
| backdrop div onKeyDown — Ctrl/Cmd+Enter saves without closing                                                           | Cmd+Enter (metaKey+Enter) on the backdrop calls onSave, not onCancel                                                                        | render with valid text, fireEvent.keyDown on backdrop div with key='Enter' + metaKey=true → onSave called, onCancel not called                             | unit-rtl       | medium |
| inner dialog div onClick stopPropagation — biome-ignore useKeyWithClickEvents comment: 'onClick only stops propagation' | clicking inside the dialog panel does NOT call onCancel (click is contained within the inner div)                                           | render open dialog, fireEvent.click on the inner dialog container div → onCancel is NOT called                                                             | unit-rtl       | high   |
| backdrop div onClick — clicking the backdrop overlay calls onCancel                                                     | clicking the backdrop div (role=presentation) calls onCancel                                                                                | render open dialog, fireEvent.click on the backdrop div (not the inner panel) → onCancel called once                                                       | unit-rtl       | high   |
| inner dialog div onClick stopPropagation — no keyboard handler mirrored                                                 | inner dialog container div has no onKeyDown or onKeyPress attribute (the biome-ignore comment states there is no keyboard action to mirror) | —                                                                                                                                                          | unit-rtl       | medium |
| textarea autoFocus — biome-ignore noAutofocus comment: 'intentional initial focus for this modal dialog'                | the Description textarea has the autofocus attribute (autoFocus prop rendered)                                                              | —                                                                                                                                                          | unit-rtl       | high   |
| textarea autoFocus — focus lands in the description field on open                                                       | after render, document.activeElement is the Description textarea                                                                            | render open dialog → check document.activeElement === textarea                                                                                             | unit-rtl       | high   |
| textarea autoFocus — focus lands in dialog, not outside, satisfying modal focus trap entry requirement                  | focus is not on document.body or a background element when dialog is open                                                                   | render open dialog with a sibling button outside the dialog → document.activeElement is inside the dialog container                                        | unit-rtl       | medium |
| dialog keyboard accessibility end-to-end — backdrop role=presentation + inner role=dialog                               | dialog container has role=dialog and aria-modal=true; backdrop has role=presentation                                                        | —                                                                                                                                                          | unit-rtl       | medium |
| Escape key from within inner dialog content closes dialog (keyboard-closable claim)                                     | onCancel fires when Escape is pressed while focus is on the textarea (event bubbles to backdrop onKeyDown handler)                          | render open dialog, focus textarea, fireEvent.keyDown on textarea with key='Escape' → onCancel called once (event bubbles to backdrop)                     | unit-rtl       | high   |
| backdrop onKeyDown — non-Escape / non-Ctrl+Enter keys are ignored                                                       | onCancel and onSave are not called when arbitrary keys (e.g. Tab, ArrowDown) are pressed on the backdrop                                    | fireEvent.keyDown on backdrop div with key='Tab' → onCancel not called, onSave not called                                                                  | unit-rtl       | low    |
| full keyboard close flow in a real browser — focus management and Escape                                                | screen reader announces dialog on open; focus enters dialog; pressing Escape dismisses it and returns focus to the trigger element          | open dialog via trigger button → Tab confirms focus inside dialog → press Escape → dialog unmounts → focus returns to trigger                              | playwright-e2e | medium |

### `apps/web/src/components/lead/request-reopen-dialog.tsx`

_Added two biome-ignore suppressions: one for lint/a11y/noStaticElementInteractions on the backdrop div (claiming keyboard-closable via Escape + Cancel), and one for lint/a11y/useKeyWithClickEvents on the inner dialog div (claiming onClick only stops propagation and Escape handles keyboard close)._  
Existing test: —

| Block                                                                                                                                            | DOM assertion                                                                                                            | Interaction                                                                                                                                | Type     | Pri    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| backdrop div onKeyDown — biome-ignore noStaticElementInteractions claim: 'dialog is keyboard-closable via Escape'                                | pressing Escape fires onCancel exactly once                                                                              | render with open=true, fireEvent.keyDown on the backdrop div with key='Escape' → onCancel called once                                      | unit-rtl | high   |
| backdrop div onKeyDown — biome-ignore noStaticElementInteractions claim: 'dialog is keyboard-closable via Cancel button'                         | Cancel button with type='button' is present and clicking it fires onCancel                                               | render with open=true, userEvent.click on Cancel button → onCancel called once                                                             | unit-rtl | high   |
| backdrop div role='presentation' — backdrop has no interactive role exposed to AT                                                                | backdrop div has role='presentation' (not 'button', 'link', or any interactive ARIA role)                                | —                                                                                                                                          | unit-rtl | high   |
| inner dialog div — biome-ignore useKeyWithClickEvents claim: 'onClick only stops propagation so inner clicks don't reach backdrop close handler' | clicking inside the dialog div does NOT fire onCancel                                                                    | render with open=true, userEvent.click anywhere inside the dialog container (e.g. the textarea) → onCancel NOT called                      | unit-rtl | high   |
| inner dialog div — biome-ignore useKeyWithClickEvents claim: 'Escape close is handled on the backdrop'                                           | pressing Escape while focus is inside the dialog (textarea focused) fires onCancel via backdrop's onKeyDown bubble       | render with open=true, focus textarea, fireEvent.keyDown on textarea with key='Escape' → event bubbles to backdrop → onCancel called once  | unit-rtl | high   |
| inner dialog div role='dialog' aria-modal='true'                                                                                                 | inner div has role='dialog' and aria-modal='true'                                                                        | —                                                                                                                                          | unit-rtl | medium |
| backdrop onClick — clicking backdrop fires onCancel                                                                                              | clicking the backdrop div directly (not the inner dialog) fires onCancel                                                 | render with open=true, userEvent.click on the backdrop overlay outside the dialog box → onCancel called once                               | unit-rtl | medium |
| Cmd/Ctrl+Enter keyboard shortcut on backdrop onKeyDown                                                                                           | pressing Ctrl+Enter (or Meta+Enter) fires onConfirm with current textarea value                                          | render with open=true, type a reason, fireEvent.keyDown on backdrop with key='Enter' ctrlKey=true → onConfirm called with trimmed reason   | unit-rtl | medium |
| initial focus — deferred autoFocus via requestAnimationFrame                                                                                     | textarea receives focus after the dialog opens (useEffect + requestAnimationFrame deferred focus)                        | render with open=true, flush rAF → textarea has document focus                                                                             | unit-rtl | medium |
| Tab order not stranded — Tab key reaches Cancel and Send Request buttons                                                                         | Tab from textarea reaches Cancel button, another Tab reaches Send Request button (no focus trap escape failure)          | render with open=true, focus textarea, press Tab → focus on Cancel button, press Tab → focus on Send Request button                        | unit-rtl | medium |
| Cancel button type='button' — does not submit forms                                                                                              | Cancel button has type='button'                                                                                          | —                                                                                                                                          | unit-rtl | low    |
| Send Request button type='button'                                                                                                                | Send Request button has type='button'                                                                                    | —                                                                                                                                          | unit-rtl | low    |
| backdrop onKeyDown — Escape preventDefault called                                                                                                | e.preventDefault() is called on Escape so that browser-native ESC behaviors (like leaving fullscreen) do not double-fire | render with open=true, create a synthetic keydown event with key='Escape', spy on preventDefault, fire on backdrop → preventDefault called | unit-rtl | low    |
| dialog aria-label                                                                                                                                | inner dialog div has aria-label='Request Reopen dialog'                                                                  | —                                                                                                                                          | unit-rtl | low    |

### `apps/web/src/components/lead/risk-edit-dialog.tsx`

_Three biome-ignore suppression comments added: noStaticElementInteractions on the backdrop div (claiming Escape + close-button keyboard-closability), useKeyWithClickEvents on the inner dialog div (claiming stopPropagation click-through guard is not interactive), and noAutofocus on the risk-text textarea (claiming intentional initial focus for modal dialog)._  
Existing test: `apps/web/src/components/lead/risk-edit-dialog.test.tsx`

| Block                                                                                                         | DOM assertion                                                                                                                              | Interaction                                                                                                                                                                       | Type           | Pri    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| backdrop div onKeyDown → Escape key                                                                           | pressing Escape on the backdrop fires onCancel (dialog unmounts / onCancel called once)                                                    | render open dialog, fireEvent.keyDown on backdrop div with key='Escape' → expect onCancel to have been called                                                                     | unit-rtl       | high   |
| backdrop div onKeyDown → Escape key — load-bearing a11y proof for biome-ignore noStaticElementInteractions    | handleKeyDown on the outer backdrop div calls e.preventDefault() and onCancel when Escape is pressed                                       | fireEvent.keyDown(backdropEl, { key: 'Escape' }) → onCancel spy called once                                                                                                       | unit-rtl       | high   |
| Cancel button in sticky footer — keyboard-closable proof for biome-ignore noStaticElementInteractions comment | clicking the Cancel button calls onCancel (alternative close path that makes the dialog keyboard-closable without relying on the backdrop) | fireEvent.click(screen.getByRole('button', { name: /Cancel/i })) → onCancel spy called once                                                                                       | unit-rtl       | high   |
| inner dialog div onClick stopPropagation — biome-ignore useKeyWithClickEvents                                 | clicking inside the dialog container does NOT call onCancel (stopPropagation prevents backdrop click-through)                              | fireEvent.click on inner dialog div (role=dialog) → onCancel spy NOT called                                                                                                       | unit-rtl       | high   |
| backdrop div onClick → clicking the backdrop itself closes dialog                                             | clicking the outer backdrop div (role=presentation) calls onCancel                                                                         | render open dialog, fireEvent.click on the element with role=presentation → onCancel spy called once                                                                              | unit-rtl       | medium |
| textarea#risk-text autoFocus — biome-ignore noAutofocus                                                       | on dialog open the textarea with id=risk-text has the document focus (autoFocus applied)                                                   | render open dialog → expect document.activeElement to be the textarea#risk-text                                                                                                   | unit-rtl       | high   |
| backdrop div role=presentation — static DOM assertion                                                         | outer backdrop div has role='presentation' (not a focusable/interactive landmark)                                                          | —                                                                                                                                                                                 | unit-rtl       | medium |
| inner dialog div role=dialog + aria-modal                                                                     | inner container has role='dialog' and aria-modal='true'                                                                                    | —                                                                                                                                                                                 | unit-rtl       | medium |
| backdrop div onKeyDown → non-Escape key does not close dialog                                                 | pressing Tab or any non-Escape key on the backdrop does NOT call onCancel                                                                  | fireEvent.keyDown(backdropEl, { key: 'Tab' }) → onCancel spy NOT called                                                                                                           | unit-rtl       | low    |
| backdrop div onKeyDown → Ctrl+Enter triggers save                                                             | pressing Ctrl+Enter on the backdrop calls onSave when all fields are valid (handleKeyDown also handles Ctrl+Enter)                         | fill all required fields + select a stage, then fireEvent.keyDown(backdropEl, { key: 'Enter', ctrlKey: true }) → onSave called once                                               | unit-rtl       | low    |
| autoFocus + Tab order — keyboard navigation not stranded                                                      | after dialog opens with autoFocus on textarea, Tab key moves focus to the next focusable element (focus is not trapped/stranded)           | render open dialog, verify document.activeElement is textarea#risk-text, then userEvent.tab() → document.activeElement changes to a different focusable element inside the dialog | playwright-e2e | medium |

### `apps/web/src/components/report-shell/lock-badge.tsx`

_Replaced tabIndex={0} with role="img" on the outer div: removes the element from keyboard tab order and declares it as an image widget (with existing aria-label); onFocus/onBlur tooltip handlers remain but are now unreachable via keyboard._  
Existing test: —

| Block                                                                   | DOM assertion                                                                                                                                 | Interaction                                                   | Type     | Pri    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- | ------ |
| outer div — role attribute                                              | div has role="img"                                                                                                                            | —                                                             | unit-rtl | high   |
| outer div — tabIndex removed                                            | div does not have attribute tabindex (i.e. tabIndex is absent/undefined, not 0)                                                               | —                                                             | unit-rtl | high   |
| outer div — aria-label preserved after role change                      | element with role="img" has aria-label matching /Read-only — authored by/                                                                     | —                                                             | unit-rtl | high   |
| outer div — aria-label with known authorName                            | element with role="img" has aria-label="Read-only — authored by Alice"                                                                        | —                                                             | unit-rtl | high   |
| outer div — aria-label with null authorName fallback                    | element with role="img" has aria-label="Read-only — authored by another lead"                                                                 | —                                                             | unit-rtl | medium |
| outer div — keyboard not focusable (tabIndex removed)                   | after Tab key press from a preceding focusable element, the lock-badge div does not receive focus (document.activeElement is not the div)     | Tab from a preceding button — lock-badge div must be skipped  | unit-rtl | high   |
| Lock icon — aria-hidden preserved                                       | svg child of role="img" div has aria-hidden="true"                                                                                            | —                                                             | unit-rtl | medium |
| onMouseEnter / onMouseLeave tooltip still fires (mouse path unaffected) | tooltip show is called when mouseenter fires on role="img" div, tooltip hide is called on mouseleave                                          | fireEvent.mouseEnter then fireEvent.mouseLeave on the div     | unit-rtl | medium |
| onFocus tooltip handler — now unreachable via keyboard                  | focus event on the div does NOT fire when Tab is pressed from preceding focusable element (handler is never triggered by keyboard navigation) | Tab from preceding button — verify tooltip.show is not called | unit-rtl | high   |
| role="img" — accessible name surfaced to screen reader                  | getByRole('img', { name: /Read-only — authored by/ }) resolves to exactly one element                                                         | —                                                             | unit-rtl | high   |
| variant=default sizing — unaffected by role change                      | role="img" div has class substring min-h-\[34px\] when variant is omitted                                                                     | —                                                             | unit-rtl | low    |
| variant=slim sizing — unaffected by role change                         | role="img" div has class substring min-h-6 when variant="slim"                                                                                | —                                                             | unit-rtl | low    |

### `apps/web/src/components/slides/status-slide-deck.tsx`

_Added aria-label to the focusable section root; added role="group" to carousel controls container; added biome-ignore suppression for noArrayIndexKey on textList; added biome-ignore suppression for useKeyWithClickEvents on LeadSlideArticle click-to-exit-fullscreen handler_  
Existing test: `apps/web/src/components/slides/status-slide-deck.test.tsx`

| Block                                                                                                       | DOM assertion                                                                                                                                                | Interaction                                                                                                             | Type     | Pri    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| StatusSlideDeck <section> aria-label                                                                        | section element has aria-label="Status slide deck (use arrow keys to navigate slides)"                                                                       | —                                                                                                                       | unit-rtl | high   |
| StatusSlideDeck <section> tabIndex                                                                          | section element has tabIndex=0 (is programmatically focusable)                                                                                               | —                                                                                                                       | unit-rtl | high   |
| StatusSlideDeck <section> keyboard region — ArrowRight advances slide                                       | onSelect is called with selectedIndex+1 after ArrowRight is fired on the section                                                                             | focus section → fireEvent.keyDown(ArrowRight) → assert onSelect called with 1                                           | unit-rtl | high   |
| StatusSlideDeck <section> keyboard region — ArrowLeft retreats slide                                        | onSelect is called with selectedIndex-1 after ArrowLeft is fired on the section                                                                              | focus section → set selectedIndex=1 → fireEvent.keyDown(ArrowLeft) → assert onSelect called with 0                      | unit-rtl | high   |
| StatusSlideDeck <section> keyboard region — ArrowRight clamped at last slide                                | onSelect is called with slides.length-1 (not slides.length) when already on last slide and ArrowRight fires                                                  | render with selectedIndex=lastIndex → fireEvent.keyDown(ArrowRight) on section → assert onSelect called with lastIndex  | unit-rtl | medium |
| StatusSlideDeck <section> keyboard region — ArrowLeft clamped at first slide                                | onSelect is called with 0 (not -1) when already on first slide and ArrowLeft fires                                                                           | render with selectedIndex=0 → fireEvent.keyDown(ArrowLeft) on section → assert onSelect called with 0                   | unit-rtl | medium |
| StatusSlideDeck <section> — section is reachable by Tab                                                     | section with tabIndex=0 appears in the tab order and can receive keyboard focus                                                                              | userEvent.tab() from body → expect section to be document.activeElement                                                 | unit-rtl | medium |
| carousel controls div role="group"                                                                          | div wrapping Previous/Next carousel buttons has role="group"                                                                                                 | —                                                                                                                       | unit-rtl | high   |
| carousel controls div aria-label                                                                            | the role="group" element has aria-label="Slide carousel controls"                                                                                            | —                                                                                                                       | unit-rtl | high   |
| carousel controls div — Previous and Next buttons are inside the group                                      | buttons with aria-label="Previous slide" and aria-label="Next slide" are descendants of the role="group" element                                             | —                                                                                                                       | unit-rtl | medium |
| carousel controls div — group is only rendered in lead mode with multiple slides                            | role="group" element is absent when mode="head" or when only one slide is present                                                                            | —                                                                                                                       | unit-rtl | medium |
| LeadSlideArticle article click-to-exit-fullscreen — no Escape suppression                                   | article element does not have an onKeyDown handler that calls preventDefault on Escape (i.e. Escape keydown on article propagates up without preventDefault) | render LeadSlideArticle → fireEvent.keyDown(article, {key:'Escape'}) → assert event.defaultPrevented is false           | unit-rtl | high   |
| LeadSlideArticle article onClick — fires click handler (calls exitFullscreen when fullscreenElement is set) | document.exitFullscreen is called when the article is clicked while document.fullscreenElement is truthy                                                     | mock document.fullscreenElement + document.exitFullscreen → fireEvent.click(article) → assert exitFullscreen was called | unit-rtl | high   |
| LeadSlideArticle article onClick — does not call exitFullscreen when not in fullscreen                      | document.exitFullscreen is NOT called when article is clicked and document.fullscreenElement is null                                                         | ensure document.fullscreenElement is null → fireEvent.click(article) → assert exitFullscreen not called                 | unit-rtl | medium |
| textList <ul> — renders all items with unique keys (no React key-dedup collision for duplicate strings)     | when textList receives two identical strings, both <li> elements are rendered in the DOM (no deduplication by React key)                                     | —                                                                                                                       | unit-rtl | medium |
| textList <ul> — item+index key pattern renders correct text content                                         | each <li> renders the exact text of the corresponding item string at the correct position                                                                    | —                                                                                                                       | unit-rtl | low    |

### `apps/web/src/components/ui/confirmation-dialog.tsx`

_Added biome-ignore suppression for lint/a11y/noStaticElementInteractions on the backdrop div, asserting the dialog is keyboard-closable via Escape and the Cancel button._  
Existing test: —

| Block                                                                                                  | DOM assertion                                                                                                   | Interaction                                                                                                       | Type     | Pri    |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| backdrop div onKeyDown / biome-ignore suppression claim                                                | pressing Escape fires onClose (document keydown listener added when open=true)                                  | render with open=true, fireEvent.keyDown(document, { key: 'Escape' }) → onClose called once                       | unit-rtl | high   |
| backdrop div onKeyDown / biome-ignore suppression claim                                                | onClose is NOT called when Escape is fired while open=false (listener not registered)                           | render with open=false, fireEvent.keyDown(document, { key: 'Escape' }) → onClose not called                       | unit-rtl | high   |
| backdrop div onClick handler (element the biome-ignore applies to)                                     | clicking the backdrop element itself fires onClose                                                              | render with open=true, fireEvent.click(backdrop div where target === currentTarget) → onClose called once         | unit-rtl | high   |
| backdrop div onClick handler — negative case                                                           | clicking inside the inner dialog container does NOT fire onClose (target !== currentTarget guard)               | render with open=true, fireEvent.click(inner alertdialog div) → onClose not called                                | unit-rtl | high   |
| Cancel button — keyboard-closable claim in biome-ignore comment                                        | Cancel button fires onClose when clicked                                                                        | render with open=true, fireEvent.click(button with cancelLabel text) → onClose called once, onConfirm not called  | unit-rtl | high   |
| Cancel button — keyboard reachability (biome-ignore claim: cancel button is the keyboard escape route) | Cancel button has type='button' (not submit) so it is keyboard-activatable without form submission side effects | —                                                                                                                 | unit-rtl | medium |
| Focus-trap effect — biome-ignore claim relies on initial focus landing in dialog                       | on open, document.activeElement is the first button (Cancel) inside dialogRef                                   | render with open=true → assert document.activeElement === cancel button element                                   | unit-rtl | high   |
| Backdrop div role attribute                                                                            | backdrop div has role='presentation' (not interactive ARIA role, consistent with suppression justification)     | —                                                                                                                 | unit-rtl | medium |
| Inner dialog ARIA semantics — load-bearing for the a11y claim                                          | inner container has role='alertdialog', aria-modal='true', and aria-label equal to the title prop               | —                                                                                                                 | unit-rtl | high   |
| Escape listener cleanup on unmount / close                                                             | after transitioning open from true to false, firing Escape does not call onClose (listener removed)             | render open=true, then rerender open=false, fireEvent.keyDown(document, { key: 'Escape' }) → onClose not called   | unit-rtl | high   |
| Confirm button — present and functional (keyboard path)                                                | Confirm button fires onConfirm when clicked and has type='button'                                               | render with open=true, fireEvent.click(button with confirmLabel text) → onConfirm called once, onClose not called | unit-rtl | medium |
| open=false guard — component renders nothing                                                           | when open=false, no alertdialog role is present in the DOM (null render path)                                   | —                                                                                                                 | unit-rtl | medium |

### `apps/web/src/components/weekly-report/publish-lock-button.tsx`

_Added aria-hidden="true" to the decorative SVG in the Reopen Period button, and added a biome-ignore suppression comment endorsing the intentional autoFocus on the publish confirmation dialog (making keyboard-dismissibility via Escape the load-bearing a11y claim)._  
Existing test: `apps/web/src/components/weekly-report/publish-lock-button.test.tsx`

| Block                                                                                                              | DOM assertion                                                                                                                | Interaction                                                                                       | Type     | Pri  |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ---- |
| Reopen Period button SVG (periodStatus=published branch, line ~63-75)                                              | svg element inside the Reopen Period button has aria-hidden="true"                                                           | —                                                                                                 | unit-rtl | high |
| publish confirmation dialog container div — autoFocus + onKeyDown Escape handler (lines 118-123)                   | pressing Escape after dialog opens removes the element with role="dialog" from the DOM                                       | click Publish & Lock trigger → dialog appears → press Escape → queryByRole("dialog") returns null | unit-rtl | high |
| publish confirmation dialog container div — autoFocus (line 120, biome-ignore comment)                             | dialog container div (role="dialog", tabIndex=-1) receives focus immediately after dialog opens, before any user interaction | click Publish & Lock trigger → assert document.activeElement is the dialog container              | unit-rtl | high |
| publish confirmation dialog container div — role and modal attributes supporting the autoFocus suppression premise | dialog container has role="dialog" and aria-modal="true"                                                                     | —                                                                                                 | unit-rtl | low  |

## Mechanical a11y files (haiku-derived)

### `apps/api/src/modules/email/templates/escalation.template.tsx`

_Type-only React import; improved list key from positional index to stable composite (leadName+sectionTitle)_  
Existing test: —

| Block                                                                 | DOM assertion                                                                                                                                           | Interaction | Type     | Pri    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| import type statement line 12                                         | module exports EscalationEmail function and EscalationEmailProps interface as React.ReactElement                                                        | —           | unit-rtl | high   |
| li render loop lines 77-85 with new key prop                          | each li element has key={`${lead.leadName}-${lead.sectionTitle}`} derived from LateLead object properties                                               | —           | snapshot | high   |
| li render loop lines 77-85 with stable key                            | li elements maintain identity when lateLeads array is reordered (same leadName+sectionTitle pair = same DOM node)                                       | —           | unit-rtl | high   |
| ul list containing mapped li children lines 76-87                     | ul renders all lateLeads without duplicate or missing li children when array contains entries with identical leadName but different sectionTitle values | —           | unit-rtl | medium |
| li text content lines 82-83                                           | strong element contains lead.leadName, followed by em-dash and lead.sectionTitle, followed by deadline in parentheses                                   | —           | unit-rtl | medium |
| EscalationEmail component render with multiple late leads lines 53-99 | component renders all LateLead entries from lateLeads array without error when count is 0, 1, 2+                                                        | —           | unit-rtl | medium |
| key change from index to composite lines 77-85                        | rendering same lateLeads array twice produces identical HTML structure with identical key attributes                                                    | —           | snapshot | medium |

### `apps/web/src/app/error.tsx`

_Function export renamed to ErrorBoundary; button element now has explicit type="button" attribute; text content reformatted to separate lines within button_  
Existing test: —

| Block                            | DOM assertion                                                                         | Interaction                           | Type     | Pri    |
| -------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | -------- | ------ |
| button element type attribute    | button has type="button" (explicit, not implicit)                                     | —                                     | unit-rtl | high   |
| button inner text content        | button contains text "Try again" (whitespace-normalized)                              | —                                     | unit-rtl | high   |
| button onClick handler           | button element has onClick listener bound to reset function                           | click button → reset callback invoked | unit-rtl | high   |
| ErrorBoundary export name        | component exports as named export ErrorBoundary (not Error)                           | —                                     | unit-rtl | medium |
| h2 heading element               | h2 element with text "Something went wrong" is rendered                               | —                                     | unit-rtl | medium |
| error parameter passed to Sentry | Sentry.captureException is called with error object in useEffect dependency           | —                                     | unit-rtl | medium |
| button element semantic role     | button element has role="button" (implicit) and is accessible via getByRole("button") | —                                     | unit-rtl | high   |
| wrapper div structure            | button is child of div container; div has no aria-live, role, or other special attrs  | —                                     | snapshot | low    |

### `/home/user/work/customreport/apps/web/src/app/global-error.tsx`

_html element now has lang="en" attribute; button element now has type="button" attribute; button content reformatted to multiline (no functional change)_  
Existing test: —

| Block                         | DOM assertion                                        | Interaction                                                      | Type     | Pri    |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | -------- | ------ |
| html element lang attribute   | html element has lang="en" attribute                 | —                                                                | snapshot | high   |
| button type attribute         | button element has type="button" attribute           | —                                                                | unit-rtl | high   |
| button text content           | button contains text 'Try again'                     | —                                                                | unit-rtl | medium |
| button onClick handler wiring | button has onClick handler that calls reset function | click button with text 'Try again' → verify reset callback fires | unit-rtl | high   |
| h2 heading presence           | h2 element renders with text 'Something went wrong'  | —                                                                | unit-rtl | medium |
| body element presence         | body element is rendered as root element container   | —                                                                | snapshot | medium |

### `apps/web/src/app/login-page.client.tsx`

_Added aria-hidden="true" to decorative login-icon SVG to prevent redundant screen-reader announcement_  
Existing test: —

| Block                             | DOM assertion                                                                                 | Interaction | Type     | Pri    |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| Primary CTA SVG (lines 284-298)   | SVG has aria-hidden="true" attribute                                                          | —           | unit-rtl | high   |
| Primary CTA SVG (lines 284-298)   | SVG does not announce to assistive technology when parent link is focused                     | —           | unit-rtl | high   |
| Primary CTA link (lines 262-300)  | Link aria-label remains intact and is the sole accessible name source                         | —           | unit-rtl | medium |
| Primary CTA link button semantics | SVG with aria-hidden="true" does not create duplicate or conflicting aria-label announcements | —           | snapshot | medium |

### `apps/web/src/components/admin/jobs-tab.tsx`

_Added role="status" to JobsSkeleton loading container div (lines 253-259) to establish proper ARIA role for the live region alongside aria-label and aria-live attributes._  
Existing test: `apps/web/src/components/admin/jobs-tab.test.tsx`

| Block                                                   | DOM assertion                                                                                                              | Interaction | Type     | Pri    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| JobsSkeleton div container role attribute               | div with data-testid='jobs-loading-state' has role='status'                                                                | —           | unit-rtl | high   |
| JobsSkeleton a11y live region complete model            | div with role='status' also has aria-label='Loading failed jobs' and aria-live='polite'                                    | —           | unit-rtl | high   |
| JobsSkeleton accessibility tree announces status region | element with role='status' is exposed in accessibility tree with aria-live='polite' semantics                              | —           | snapshot | medium |
| JobsSkeleton renders correctly during loading state     | JobsSkeleton container is present with all three attributes (role, aria-label, aria-live) when listQuery.isPending is true | —           | unit-rtl | medium |

### `apps/web/src/components/admin/reminders-tab.tsx`

_Added aria-hidden="true" to decorative bell SVG icon in empty state to exclude it from accessibility tree_  
Existing test: `apps/web/src/components/admin/reminders-tab.test.tsx`

| Block                                          | DOM assertion                                                                                          | Interaction | Type     | Pri    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------ |
| empty-state bell SVG icon                      | SVG has aria-hidden="true"                                                                             | —           | unit-rtl | high   |
| empty-state bell SVG (accessibility contract)  | SVG is not exposed to screen readers (aria-hidden prevents ARIA subtree traversal)                     | —           | unit-rtl | high   |
| empty-state heading and text remain accessible | h3 'No reminder policies yet' is visible and has no aria-hidden; descriptive paragraphs are accessible | —           | unit-rtl | medium |

### `apps/web/src/components/admin/settings-tab.tsx`

_Removed redundant aria-label from inert holidays span; added aria-hidden=true to decorative CheckIcon SVG for a11y compliance._  
Existing test: `apps/web/src/components/admin/settings-tab.test.tsx`

| Block                                                | DOM assertion                                                                                                                     | Interaction                                                         | Type     | Pri    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- | ------ |
| HolidaysComingSoonControl span element               | span does NOT have aria-label attribute (removed: was 'Holidays calendar is coming soon')                                         | —                                                                   | unit-rtl | high   |
| HolidaysComingSoonControl span element               | span retains aria-disabled=true attribute                                                                                         | —                                                                   | unit-rtl | high   |
| HolidaysComingSoonControl span element               | span still has data-testid='holidays-coming-soon' for test selectors                                                              | —                                                                   | unit-rtl | medium |
| HolidaysComingSoonControl Calendar icon              | Calendar (lucide-react) icon retains aria-hidden=true on its internal svg                                                         | —                                                                   | unit-rtl | high   |
| CheckIcon SVG decorative element                     | SVG has aria-hidden='true' attribute (added, was missing)                                                                         | —                                                                   | unit-rtl | high   |
| CheckIcon SVG in IdentitySubTab success message      | SVG renders with aria-hidden=true when 'Identity saved' message appears after successful save                                     | click Save button after editing short/full name                     | unit-rtl | high   |
| CheckIcon SVG in PeriodsSubTab success message       | SVG renders with aria-hidden=true when 'Period settings saved' message appears                                                    | click Save button on Periods tab after editing a period setting     | unit-rtl | high   |
| CheckIcon SVG in RemindersSubTab success message     | SVG renders with aria-hidden=true when 'Reminder defaults saved' message appears                                                  | click Save button on Reminders tab after editing a reminder setting | unit-rtl | high   |
| CheckIcon SVG in NotificationsSubTab success message | SVG renders with aria-hidden=true when 'Notification settings saved' message appears                                              | click Save button on Notifications tab after entering a valid email | unit-rtl | high   |
| CheckIcon function component                         | SVG viewBox, stroke, fill, strokeWidth, strokeLinecap, and strokeLinejoin attributes unchanged                                    | —                                                                   | snapshot | medium |
| HolidaysComingSoonControl ComingSoonBadge tooltip    | Tooltip (ComingSoonBadge) still renders with role='tooltip' and is keyboard/hover accessible despite aria-label removal from span | hover over holidays-coming-soon element                             | unit-rtl | medium |
| Success message DOM structure in all tabs            | CheckIcon SVG (with aria-hidden=true) and text node coexist in success message span without changing flex layout                  | —                                                                   | snapshot | medium |

### `/home/user/work/customreport/apps/web/src/components/dashboard/activity-24h-card.tsx`

_Changed root container from div to section element; aria-label preserved for accessible landmark_  
Existing test: —

| Block                                 | DOM assertion                                                                                                                              | Interaction | Type     | Pri    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------ |
| Root container semantic element       | Root element has role="region" (implicit from section + aria-label)                                                                        | —           | unit-rtl | high   |
| Root container aria-label             | Region has aria-label="24h Activity: <count> updates in last 24 hours" (or "loading" when data null)                                       | —           | unit-rtl | high   |
| Root container data-testid            | section element has data-testid="activity-24h-card"                                                                                        | —           | unit-rtl | medium |
| Root container classes and styles     | section has className with rounded, border, bg, p-5, shadow; has inline style with borderLeft 3px solid                                    | —           | snapshot | medium |
| Heading label rendered inside section | p element with text '24h Activity' and classes 'mb-2 text-sm font-medium text-[var(--color-muted-foreground)]' renders as child of section | —           | unit-rtl | medium |
| Loading state within section          | When isLoading=true and count=null, div.animate-pulse renders inside section (not outside)                                                 | —           | unit-rtl | high   |
| Count display within section          | When isLoading=false, count value (or em-dash) renders in div.text-[32px] inside section                                                   | —           | unit-rtl | high   |
| Footer text within section            | When isLoading=false, p element with text 'Updates in last 24h' renders as last child of section                                           | —           | unit-rtl | medium |
| Semantic nesting structure            | All content (p, div, count text) is nested as direct or indirect children of section; no content escapes the section                       | —           | snapshot | high   |

### `apps/web/src/components/dashboard/activity-live-panel.tsx`

_Removed aria-label from draft-status div (line 182) and changed aria-label to title attribute on empty-status div (line 189) for Biome a11y compliance_  
Existing test: —

| Block                                                   | DOM assertion                                                                                           | Interaction | Type     | Pri    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| draft-status div container (line 180-185)               | div with draftClassName has no aria-label attribute                                                     | —           | unit-rtl | high   |
| draft-status div container (line 180-185)               | div with draftClassName renders with title='Lead is still working, report not submitted'                | —           | unit-rtl | high   |
| empty-status div container (line 187-192)               | div with emptyClassName has title attribute equal to row.leadName + ' has no report content yet'        | —           | unit-rtl | high   |
| empty-status div container (line 187-192)               | div with emptyClassName has no aria-label attribute                                                     | —           | unit-rtl | high   |
| ActivityRow draft-status branch (hasContent && isDraft) | rendered div is not interactive (has cursor-default class, not cursor-pointer)                          | —           | snapshot | medium |
| ActivityRow empty-status branch (no content)            | rendered div has emptyClassName applied (cursor-default, transparent border, muted styling, opacity-65) | —           | snapshot | medium |

### `apps/web/src/components/dashboard/alert-bar.tsx`

_Three mechanical a11y/DOM fixes: SVG aria-hidden attribute, stable span key, biome-ignore comment for custom IfRole aria role_  
Existing test: `apps/web/src/components/dashboard/alert-bar.test.tsx`

| Block                                       | DOM assertion                                                                                                                               | Interaction | Type     | Pri    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| AlertIcon svg element                       | svg has aria-hidden="true"                                                                                                                  | —           | unit-rtl | high   |
| AlertIcon svg decorative presence           | svg with aria-hidden="true" is present in rendered DOM                                                                                      | —           | snapshot | high   |
| pendingNames span list item key             | span elements in pendingNames map use stable key={name} without index suffix                                                                | —           | unit-rtl | medium |
| pendingNames rendering with duplicate names | all pending lead names render correctly when names are unique (Alice, Bob)                                                                  | —           | unit-rtl | medium |
| IfRole admin link biome-ignore comment      | IfRole component with custom aria role renders without Biome linting error                                                                  | —           | unit-rtl | low    |
| alert bar semantic structure post-svg-a11y  | alert container maintains proper roles/structure: decorative SVG hidden from a11y tree, button with type="button", heading content in spans | —           | snapshot | high   |
| AlertIcon visual accessibility              | warning icon SVG is excluded from screen reader announcement via aria-hidden                                                                | —           | unit-rtl | medium |

### `/home/user/work/customreport/apps/web/src/components/dashboard/blocked-at-risk-table.tsx`

_Added aria-hidden="true" to decorative SVGs (AlertIcon and ChevronDown) to hide them from screen readers._  
Existing test: `apps/web/src/components/dashboard/blocked-at-risk-table.test.tsx`

| Block                                                | DOM assertion                                                                                                                                            | Interaction | Type     | Pri    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| AlertIcon svg aria-hidden                            | AlertIcon svg element has aria-hidden="true" attribute                                                                                                   | —           | unit-rtl | high   |
| ChevronDown svg aria-hidden                          | ChevronDown svg element has aria-hidden="true" attribute                                                                                                 | —           | unit-rtl | high   |
| button heading text accessibility                    | button role contains visible text 'Blocked & At Risk' and count badge as primary accessible label (SVG icons are hidden, not contributing to aria-label) | —           | unit-rtl | medium |
| expanded/collapsed chevron icon screen-reader hiding | aria-expanded attribute on button accurately reflects expanded state; ChevronDown svg does not contribute to button name (aria-hidden)                   | —           | unit-rtl | medium |
| alert icon semantics in header                       | AlertIcon svg with aria-hidden does not create redundant screen-reader announcement; heading text 'Blocked & At Risk' alone conveys severity             | —           | unit-rtl | medium |

### `apps/web/src/components/dashboard/dashboard-skeleton.tsx`

_Added biome-ignore lint suppression comment for noArrayIndexKey on static column-width array map (line 66); no DOM/a11y/behavior changes_  
Existing test: —

| Block                                      | DOM assertion                                                                                                                                                         | Interaction | Type     | Pri    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| thead placeholder skeleton array map       | 5 Skeleton elements render with correct widths [120px, 80px, 80px, 80px, 100px]                                                                                       | —           | snapshot | high   |
| thead placeholder column headers structure | flex container with gap-4 has 5 child Skeleton components with correct CSS classes                                                                                    | —           | unit-rtl | high   |
| DashboardSkeleton full render              | complete skeleton tree renders: ActivityLivePanel, KPI Cards, Activity24h, LeadSummaryTable (with thead + 5 tbody rows), ProductKpiCard, AlertBar, BlockedAtRiskTable | —           | snapshot | medium |
| thead Skeleton array keys stability        | 5 Skeleton elements in column header have stable key prop matching array index (key=0, key=1, key=2, key=3, key=4)                                                    | —           | unit-rtl | medium |
| column widths dynamic class rendering      | Skeleton className correctly applies w-[120px], w-[80px], w-[80px], w-[80px], w-[100px] via template literal interpolation                                            | —           | unit-rtl | medium |

### `apps/web/src/components/dashboard/kpi-cards.tsx`

_Semantic HTML: converted 3 presentation divs to section elements with aria-labels; no logic or styling changes_  
Existing test: —

| Block                                  | DOM assertion                                                                                                                          | Interaction | Type     | Pri    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| Submissions card root element          | first KPI card renders as section (not div) with role='region' implied by section + aria-label                                         | —           | unit-rtl | high   |
| Submissions card aria-label            | section has aria-label='Submissions: {submitted} of {total}, {pendingCount} pending'                                                   | —           | unit-rtl | high   |
| Deadline card root element             | second KPI card renders as section (not div) with role='region' implied by section + aria-label                                        | —           | unit-rtl | high   |
| Deadline card aria-label               | section has aria-label='Deadline: {deadlineLabel}, {deadlineTime}'                                                                     | —           | unit-rtl | high   |
| Risks & Blockers card root element     | third KPI card renders as section (not div) with role='region' implied by section + aria-label                                         | —           | unit-rtl | high   |
| Risks & Blockers card aria-label       | section has aria-label='Risks: {blockedCount} blocked, {atRiskCount} at risk, {decisionCount} decisions'                               | —           | unit-rtl | high   |
| KPI cards accessibility tree           | all 3 KPI cards appear as 3 distinct regions in accessibility tree; each region has its aria-label as accessible name                  | —           | unit-rtl | medium |
| KPI cards visual layout preservation   | section elements inherit grid styling from parent div.grid; no layout shift from div→section conversion                                | —           | snapshot | medium |
| Submissions card internal content      | section contains p.mb-2 'Submissions', flex container with conic-gradient ring, percentage display, last-week count, and pending badge | —           | unit-rtl | medium |
| Deadline card internal content         | section contains p.mb-2 'Deadline', large bold deadline label, and smaller deadline time text                                          | —           | unit-rtl | medium |
| Risks & Blockers card internal content | section contains p.mb-2 'Risks & Blockers', three flex columns with Blocked, At Risk, and Decisions counts and labels                  | —           | unit-rtl | medium |
| CSS classes on cards untouched         | all three sections retain className='rounded-[var(--radius)] border ...' and inline style={{borderLeft}} unchanged                     | —           | snapshot | low    |

### `apps/web/src/components/dashboard/product-kpi-card.tsx`

_Added role="img" to sparkline container; removed aria-label from Stat wrapper div_  
Existing test: `apps/web/src/components/dashboard/product-kpi-card.test.tsx`

| Block                                    | DOM assertion                                                                                            | Interaction | Type     | Pri    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| sparkline container (lines 102-106)      | div has role="img"                                                                                       | —           | unit-rtl | high   |
| sparkline container (lines 102-106)      | element has aria-label="On-time ratio sparkline over the last 4 periods"                                 | —           | unit-rtl | high   |
| sparkline container (lines 102-106)      | aria-hidden wrapper div (child of role=img) has aria-hidden="true"                                       | —           | unit-rtl | high   |
| sparkline container (lines 102-106)      | aria-hidden wrapper div has tabIndex={-1}                                                                | —           | unit-rtl | medium |
| Stat component wrapper div (line 140)    | div does NOT have aria-label attribute                                                                   | —           | unit-rtl | high   |
| Stat component wrapper div (line 140)    | div has class="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-3" (no aria-label) | —           | unit-rtl | medium |
| Stat component label text (line 141-143) | label and value text are present and readable as children of the container                               | —           | unit-rtl | high   |

### `apps/web/src/components/dashboard/report-archive-section.tsx`

_Added role="img" to TrafficDot span; replaced Array.from index-based keys in ArchiveSkeletonGrid with stable SKELETON_KEYS constant to fix React key stability and a11y._  
Existing test: —

| Block                                           | DOM assertion                                                                                                | Interaction | Type     | Pri    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------ |
| TrafficDot span role attribute                  | span has role="img"                                                                                          | —           | unit-rtl | high   |
| TrafficDot span aria-label                      | span with role="img" has aria-label attribute combining label and count                                      | —           | unit-rtl | high   |
| ArchiveSkeletonGrid skeleton div keys           | each skeleton div has key from SKELETON_KEYS (sk-0 through sk-7), not numeric index                          | —           | snapshot | high   |
| ArchiveSkeletonGrid skeleton div aria-hidden    | each skeleton div has aria-hidden="true"                                                                     | —           | unit-rtl | high   |
| ArchiveSkeletonGrid renders exactly 8 skeletons | 8 skeleton divs rendered when loading, matching SKELETON_KEYS length                                         | —           | unit-rtl | medium |
| TrafficDot dot span has color class             | inner span with className combining h-2 w-2 rounded-full and color (e.g. bg-[var(--color-starbucks-accent)]) | —           | unit-rtl | medium |
| ArchiveSkeletonGrid skeleton div structure      | skeleton divs maintain full DOM structure (mb-3, flex layout, placeholder divs) with aria-hidden parent      | —           | snapshot | medium |

### `apps/web/src/components/forbidden-page.tsx`

_Removed redundant role="main" attribute from <main> element (native landmark element implicitly has role="main")_  
Existing test: `apps/web/src/components/forbidden-page.test.tsx`

| Block                               | DOM assertion                                                                                                                 | Interaction | Type     | Pri    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| main element semantic role          | main element has implicit role="main" (via native semantic element, not explicit attribute)                                   | —           | unit-rtl | high   |
| main element accessibility tree     | main element is a valid landmark in the accessibility tree after removal of explicit role                                     | —           | unit-rtl | high   |
| main element layout classes intact  | main element retains className="flex min-h-screen items-center justify-center bg-background px-6" with no removal or mutation | —           | snapshot | high   |
| Card child rendering unchanged      | Card component is still a direct child of main with className="max-w-md" intact                                               | —           | snapshot | medium |
| CardHeader content rendering        | CardHeader with CardTitle "Page unavailable for your role" renders without change                                             | —           | unit-rtl | medium |
| CardContent text and link rendering | CardContent renders paragraph text about required role and Button with Link to /head/dashboard without mutation               | —           | unit-rtl | medium |

### `apps/web/src/components/landing/pulse-background.tsx`

_Added aria-hidden="true" to the first SVG path element (ECG primary track) to explicitly mark it as decorative and hidden from screen readers_  
Existing test: —

| Block                       | DOM assertion                                                                         | Interaction | Type     | Pri    |
| --------------------------- | ------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| primary ECG path element    | first path element has aria-hidden="true" attribute                                   | —           | unit-rtl | high   |
| primary ECG path element    | path element is rendered and not removed from DOM despite aria-hidden                 | —           | unit-rtl | high   |
| SVG accessibility hierarchy | SVG container has aria-hidden="true" (must remain present across change)              | —           | unit-rtl | high   |
| pulse-bg container          | div.pulse-bg has aria-hidden="true" (must remain present across change)               | —           | unit-rtl | high   |
| secondary ECG path element  | second path element does NOT have aria-hidden attribute (unchanged behavior)          | —           | unit-rtl | medium |
| primary path d attribute    | primary path d attribute equals ECG_PRIMARY_D constant (unchanged SVG geometry)       | —           | unit-rtl | medium |
| secondary path d attribute  | secondary path d attribute equals ECG_SECONDARY_D constant (unchanged SVG geometry)   | —           | unit-rtl | medium |
| SVG element attributes      | SVG has viewBox="0 0 2400 200" (unchanged)                                            | —           | unit-rtl | low    |
| SVG element attributes      | SVG has preserveAspectRatio="none" (unchanged)                                        | —           | unit-rtl | low    |
| SVG element attributes      | SVG has focusable="false" (unchanged)                                                 | —           | unit-rtl | low    |
| secondary path CSS class    | second path has className="track-secondary" (unchanged)                               | —           | unit-rtl | low    |
| secondary path transform    | second path has transform="translate(0,40)" (unchanged)                               | —           | unit-rtl | low    |
| component snapshot          | complete rendered HTML matches expected DOM tree with new aria-hidden on primary path | —           | snapshot | medium |

### `apps/web/src/components/landing/pulse-mark.tsx`

_Added role="img" to container div for proper accessibility semantics (element with aria-label now announces as an image)_  
Existing test: —

| Block                              | DOM assertion                                                                                                  | Interaction | Type     | Pri    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| root container div                 | div has role="img"                                                                                             | —           | unit-rtl | high   |
| root container div with aria-label | div with role="img" has aria-label="Your PULSE"                                                                | —           | unit-rtl | high   |
| first span.pulse-word              | span.pulse-word has aria-hidden="true"                                                                         | —           | unit-rtl | high   |
| second span.pulse-strong           | span.pulse-strong has aria-hidden="true"                                                                       | —           | unit-rtl | high   |
| PulseMark component render tree    | entire component tree renders: role=img container → YOUR (aria-hidden) + PULSE (aria-hidden) children          | —           | snapshot | medium |
| role=img semantics accessibility   | role=img with aria-label is exposed to accessibility tree as a single composite image, not nested text content | —           | unit-rtl | high   |

### `apps/web/src/components/landing/tagline-cycler.tsx`

_Removed invalid role="text" from p element, restoring semantic paragraph role_  
Existing test: `apps/web/src/components/landing/tagline-cycler.test.tsx`

| Block                                      | DOM assertion                                                                       | Interaction | Type     | Pri    |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| p element role attribute                   | p element has implicit role="paragraph" (no invalid role="text" override)           | —           | unit-rtl | high   |
| getByRole('paragraph') query compatibility | element is found by screen.getByRole('paragraph') after role="text" removal         | —           | unit-rtl | high   |
| semantic accessibility tree                | p element exposes correct semantic role in accessibility tree (paragraph, not text) | —           | unit-rtl | medium |

### `apps/web/src/components/lead/decisions-section.tsx`

_Added aria-hidden="true" to EditIcon and DeleteIcon SVGs to hide decorative icons from screen readers (Biome a11y ruleset)_  
Existing test: `apps/web/src/components/lead/decisions-section.snapshot.test.tsx`

| Block                                   | DOM assertion                                                                                                            | Interaction | Type     | Pri    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------ |
| EditIcon svg element                    | svg has aria-hidden="true" attribute                                                                                     | —           | unit-rtl | high   |
| DeleteIcon svg element                  | svg has aria-hidden="true" attribute                                                                                     | —           | unit-rtl | high   |
| Edit button with EditIcon child         | button element has aria-label="Edit decision", child svg has aria-hidden="true"                                          | —           | unit-rtl | high   |
| Delete button with DeleteIcon child     | button element has aria-label matching "Delete decision for", child svg has aria-hidden="true"                           | —           | unit-rtl | high   |
| Edit button DOM accessibility tree      | edit button is accessible and icon is hidden from a11y tree (svg with aria-hidden does not contribute to button label)   | —           | snapshot | medium |
| Delete button DOM accessibility tree    | delete button is accessible and icon is hidden from a11y tree (svg with aria-hidden does not contribute to button label) | —           | snapshot | medium |
| Edit button screen-reader interaction   | button announces as 'Edit decision' with no icon content leaking into accessible name                                    | —           | unit-rtl | high   |
| Delete button screen-reader interaction | button announces as 'Delete decision for [product name]' with no icon SVG paths in accessible name                       | —           | unit-rtl | high   |

### `apps/web/src/components/lead/fill-from-button.tsx`

_Added aria-hidden="true" to two decorative SVG icons (CopyIcon and ChevronDown) to hide them from screen readers._  
Existing test: `apps/web/src/components/lead/fill-from-button.test.tsx`

| Block                                                      | DOM assertion                                                                                                            | Interaction                                                                                | Type     | Pri    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- | ------ |
| CopyIcon SVG                                               | svg has aria-hidden="true"                                                                                               | —                                                                                          | unit-rtl | high   |
| CopyIcon SVG within primary Fill button                    | button with name /Fill/ contains svg with aria-hidden="true"                                                             | —                                                                                          | unit-rtl | high   |
| ChevronDown SVG                                            | svg has aria-hidden="true"                                                                                               | —                                                                                          | unit-rtl | high   |
| ChevronDown SVG within dropdown trigger button             | button with name "Choose past report to fill from" contains svg with aria-hidden="true"                                  | —                                                                                          | unit-rtl | high   |
| Primary Fill button keyboard/screen reader interaction     | button has aria-label or accessible text ("Fill") and aria-hidden svg does not interfere with button accessibility       | Tab to button, verify role=button and accessible name is "Fill"                            | unit-rtl | medium |
| Dropdown trigger button keyboard/screen reader interaction | button has aria-label="Choose past report to fill from" and aria-hidden svg does not interfere with button accessibility | Tab to button, verify role=button and accessible name is "Choose past report to fill from" | unit-rtl | medium |

### `apps/web/src/components/lead/item-card.tsx`

_Added aria-hidden to decorative SVG icons (EditIcon, DeleteIcon) and role="img" to badge containers (priority rank, stage tags) for a11y compliance._  
Existing test: —

| Block                                                       | DOM assertion                                                                                                                                | Interaction | Type     | Pri    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| EditIcon SVG                                                | svg has aria-hidden="true"                                                                                                                   | —           | snapshot | high   |
| DeleteIcon SVG                                              | svg has aria-hidden="true"                                                                                                                   | —           | snapshot | high   |
| Priority rank badge span                                    | span container has role="img"                                                                                                                | —           | unit-rtl | high   |
| Priority rank badge span                                    | span has aria-label="Priority <rank>" (e.g. "Priority 2")                                                                                    | —           | unit-rtl | high   |
| Stage tags container span                                   | span has role="img"                                                                                                                          | —           | unit-rtl | high   |
| Stage tags container span                                   | span has aria-label="Item stages: <stage-list>" (e.g. "Item stages: S1, S2")                                                                 | —           | unit-rtl | high   |
| Edit button with EditIcon child                             | button renders EditIcon with aria-hidden="true" nested SVG (icon hidden from a11y tree, button aria-label="Edit" is the accessible name)     | —           | unit-rtl | medium |
| Delete button with DeleteIcon child                         | button renders DeleteIcon with aria-hidden="true" nested SVG (icon hidden from a11y tree, button aria-label="Delete" is the accessible name) | —           | unit-rtl | medium |
| Priority rank badge when item.priorityRank is null          | priority rank span is not rendered in DOM (conditional rendering)                                                                            | —           | unit-rtl | medium |
| Stage tags container with multiple visible stages           | role="img" span contains nested stage tag spans with title attributes and stage text, plus optional +N count span                            | —           | unit-rtl | medium |
| Stage tags container with zero stages (All stages fallback) | role="img" span contains "All stages" nested span, aria-label="Item stages: All stages"                                                      | —           | unit-rtl | medium |
| Item card card DOM structure                                | EditIcon and DeleteIcon SVGs both have aria-hidden="true" and do not interfere with button a11y (button labels still accessible)             | —           | snapshot | high   |

### `apps/web/src/components/lead/lead-form-skeleton.tsx`

_Added role="status" to root container and biome-ignore suppression for array-index key in placeholder accordion skeleton rows._  
Existing test: —

| Block                                                           | DOM assertion                                                                                                           | Interaction | Type     | Pri    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| LeadFormSkeleton root container role attribute                  | root div has role="status"                                                                                              | —           | unit-rtl | high   |
| LeadFormSkeleton root container aria-busy                       | root div has aria-busy="true"                                                                                           | —           | unit-rtl | high   |
| LeadFormSkeleton root container aria-label                      | root div has aria-label="Loading report form"                                                                           | —           | unit-rtl | high   |
| LeadFormSkeleton root container role + aria attributes together | root div combines role="status" + aria-busy="true" + aria-label without conflicts                                       | —           | snapshot | medium |
| PlaceholderAccordion skeleton rows key prop with array index    | each Skeleton in PlaceholderAccordion array is rendered (key={i} does not cause missing DOM nodes)                      | —           | unit-rtl | medium |
| PlaceholderAccordion skeleton rows order stability              | all Skeleton children in .space-y-2 div appear in same order across rerenders (5 Skeleton elements for 5-row accordion) | —           | snapshot | medium |

### `apps/web/src/components/lead/lead-form.tsx`

_Added aria-hidden="true" to 6 decorative SVG icons (GridIcon, CalendarIcon, NextWeekIcon, AlertIcon, ChatIcon, CollapseIcon) to hide them from accessibility tree._  
Existing test: `apps/web/src/components/lead/lead-form.test.tsx`

| Block                              | DOM assertion                                                              | Interaction | Type     | Pri    |
| ---------------------------------- | -------------------------------------------------------------------------- | ----------- | -------- | ------ |
| GridIcon svg element               | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| CalendarIcon svg element           | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| NextWeekIcon svg element           | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| AlertIcon svg element              | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| ChatIcon svg element               | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| CollapseIcon svg element           | svg has aria-hidden="true" attribute                                       | —           | unit-rtl | high   |
| All icon SVGs in rendered LeadForm | all svg elements have aria-hidden="true" when rendered as part of the form | —           | snapshot | medium |

### `apps/web/src/components/lead/lead-history-list.tsx`

_Added role="img" to TrafficDot span element for semantic a11y; traffic light indicators now properly announced as images with aria-labels_  
Existing test: `apps/web/src/components/lead/lead-history-list.test.tsx`

| Block                         | DOM assertion                                                                 | Interaction | Type     | Pri  |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------- | -------- | ---- |
| TrafficDot span wrapper       | span has role="img"                                                           | —           | unit-rtl | high |
| TrafficDot green indicator    | Green traffic dot has role="img" and aria-label="Green statuses: 2"           | —           | unit-rtl | high |
| TrafficDot yellow indicator   | Yellow traffic dot has role="img" and aria-label="Yellow statuses: 0"         | —           | unit-rtl | high |
| TrafficDot red indicator      | Red traffic dot has role="img" and aria-label="Red statuses: 1"               | —           | unit-rtl | high |
| TrafficDot accessibility tree | All three traffic dots are exposed in a11y tree as images with correct labels | —           | unit-rtl | high |

### `apps/web/src/components/lead/lead-history-skeleton.tsx`

_Added role="status" to container and biome-ignore comment for array index key in skeleton placeholders_  
Existing test: —

| Block                               | DOM assertion                                                                                 | Interaction | Type     | Pri    |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| outer container div role attribute  | container div has role="status"                                                               | —           | unit-rtl | high   |
| outer container aria attributes     | container has aria-busy="true" and aria-label="Loading history"                               | —           | unit-rtl | high   |
| skeleton placeholder grid structure | container has className containing 'grid gap-4 sm:grid-cols-2'                                | —           | unit-rtl | medium |
| skeleton item count rendering       | renders exactly 'count' number of child divs (default 6 or custom)                            | —           | unit-rtl | medium |
| array index key assignment          | each skeleton card div has key prop set to array index (biome-ignore suppression is in place) | —           | snapshot | low    |

### `apps/web/src/components/lead/period-navigator.tsx`

_Added aria-hidden="true" to ChevronLeft and ChevronRight decorative SVGs; added biome-ignore for a11y/useSemanticElements on group role container div (intentional non-semantic layout)_  
Existing test: `apps/web/src/components/lead/period-navigator.test.tsx`

| Block                                            | DOM assertion                                                                                                               | Interaction | Type     | Pri    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| ChevronLeft SVG aria-hidden attribute            | svg element in ChevronLeft has aria-hidden="true"                                                                           | —           | unit-rtl | high   |
| ChevronRight SVG aria-hidden attribute           | svg element in ChevronRight has aria-hidden="true"                                                                          | —           | unit-rtl | high   |
| ChevronLeft decorative purpose                   | aria-hidden SVG in Previous button does not expose icon to accessibility tree                                               | —           | unit-rtl | high   |
| ChevronRight decorative purpose                  | aria-hidden SVG in Next button does not expose icon to accessibility tree                                                   | —           | unit-rtl | high   |
| ChevronRight in select decorator aria-hidden     | decorative chevron span in select wrapper has aria-hidden SVG                                                               | —           | unit-rtl | high   |
| Container div group role with biome-ignore       | div container has role="group" and aria-label="Period navigation (swipe left/right or use arrows)" (non-semantic by intent) | —           | snapshot | medium |
| Previous button renders with aria-hidden chevron | Previous button text visible; aria-hidden chevron does not add duplicate content to button accessibility                    | —           | unit-rtl | high   |
| Next button renders with aria-hidden chevron     | Next button text visible; aria-hidden chevron does not add duplicate content to button accessibility                        | —           | unit-rtl | high   |

### `apps/web/src/components/lead/risks-section.tsx`

_Added aria-hidden="true" to EditIcon and DeleteIcon SVGs to mark decorative icons as hidden from screen readers_  
Existing test: `apps/web/src/components/lead/risks-section.test.tsx`

| Block                                   | DOM assertion                                                                                                     | Interaction                       | Type     | Pri    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------- | ------ |
| EditIcon SVG                            | svg element has aria-hidden="true"                                                                                | —                                 | unit-rtl | high   |
| DeleteIcon SVG                          | svg element has aria-hidden="true"                                                                                | —                                 | unit-rtl | high   |
| Edit button with EditIcon child         | button has aria-label="Edit risk for..." and child SVG has aria-hidden="true" (icon not double-announced)         | —                                 | unit-rtl | high   |
| Delete button with DeleteIcon child     | button has aria-label="Delete risk for..." and child SVG has aria-hidden="true" (icon not double-announced)       | —                                 | unit-rtl | high   |
| Decorative icon accessibility           | screen reader only announces button aria-label, not icon path elements (semantic tree excludes hidden SVG)        | —                                 | snapshot | medium |
| Edit button focus and keyboard access   | Edit button receives focus and can be activated with Enter; aria-hidden SVG does not affect keyboard navigation   | Tab to edit button, press Enter   | unit-rtl | medium |
| Delete button focus and keyboard access | Delete button receives focus and can be activated with Enter; aria-hidden SVG does not affect keyboard navigation | Tab to delete button, press Enter | unit-rtl | medium |

### `apps/web/src/components/lead/version-history-nav.tsx`

_Added aria-hidden="true" to ChevronLeft and ChevronRight SVG icons to mark them as decorative and exclude from accessibility tree_  
Existing test: —

| Block                                          | DOM assertion                                                                                                                      | Interaction                                            | Type     | Pri    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- | ------ |
| ChevronLeft SVG                                | svg element has aria-hidden="true" attribute                                                                                       | —                                                      | unit-rtl | high   |
| ChevronRight SVG                               | svg element has aria-hidden="true" attribute                                                                                       | —                                                      | unit-rtl | high   |
| ChevronLeft in handlePrev button               | button containing ChevronLeft SVG retains type="button" and aria-label="Previous version"                                          | —                                                      | unit-rtl | high   |
| ChevronRight in handleNext button              | button containing ChevronRight SVG retains type="button" and aria-label="Next version"                                             | —                                                      | unit-rtl | high   |
| Previous button accessibility                  | Previous button has aria-label="Previous version" and child SVG does not duplicate role or expose to screen readers                | Tab to Previous button, verify single accessible name  | unit-rtl | high   |
| Next button accessibility                      | Next button has aria-label="Next version" and child SVG does not duplicate role or expose to screen readers                        | Tab to Next button, verify single accessible name      | unit-rtl | high   |
| Modal dialog rendering with decorated icons    | modal role="dialog" renders with aria-hidden SVGs in buttons without affecting dialog's aria-modal or aria-label                   | click modal open button → verify dialog is accessible  | unit-rtl | medium |
| ChevronLeft SVG interior elements              | path element inside ChevronLeft inherits aria-hidden from parent SVG                                                               | —                                                      | snapshot | medium |
| ChevronRight SVG interior elements             | path element inside ChevronRight inherits aria-hidden from parent SVG                                                              | —                                                      | snapshot | medium |
| Previous button visual appearance and function | Previous button renders ChevronLeft with decorative aria-hidden and remains clickable; click triggers handlePrev when hasPrev=true | click Previous button → verify currentIndex increments | unit-rtl | medium |
| Next button visual appearance and function     | Next button renders ChevronRight with decorative aria-hidden and remains clickable; click triggers handleNext when hasNext=true    | click Next button → verify currentIndex decrements     | unit-rtl | medium |

### `apps/web/src/components/navigation/nav-bar-skeleton.tsx`

_Added biome-ignore comment justifying aria-hidden=true on the header element (no DOM/behavior change)_  
Existing test: —

| Block | DOM assertion | Interaction | Type | Pri |
| ----- | ------------- | ----------- | ---- | --- |

### `apps/web/src/components/report-shell/accordion-section.tsx`

_Added aria-hidden="true" to decorative ChevronDown SVG icon in accordion toggle button_  
Existing test: `apps/web/src/components/report-shell/report-shell.test.tsx`

| Block                                                      | DOM assertion                                                                                                                                                                 | Interaction                                            | Type     | Pri    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- | ------ |
| ChevronDown SVG decorative icon (line 7-17)                | svg has aria-hidden="true"                                                                                                                                                    | —                                                      | unit-rtl | high   |
| Button toggle (main expand/collapse button, line 70-101)   | button role, aria-expanded attribute present and reflects expanded state, ChevronDown icon renders inside                                                                     | —                                                      | unit-rtl | high   |
| Secondary chevron button with actions (line 106-115)       | button has aria-expanded attribute, button has aria-label, ChevronDown icon inside has aria-hidden="true"                                                                     | —                                                      | unit-rtl | high   |
| AccordionSection with no actions (line 100)                | ChevronDown SVG appears only in primary toggle button, not in secondary button, aria-hidden="true" present                                                                    | —                                                      | snapshot | medium |
| AccordionSection with actions (line 102-115)               | two ChevronDown SVGs rendered (one per button), both have aria-hidden="true", secondary button has aria-label                                                                 | —                                                      | snapshot | medium |
| Keyboard accessibility - Tab order (line 70-115)           | primary toggle button is focusable and keyboard-operable, secondary chevron button is focusable only when actions exist, decorative SVG aria-hidden does not affect tab order | Tab key navigation through buttons, verify focus order | unit-rtl | medium |
| Screen reader semantics - main toggle (line 70-101)        | button announces expanded state via aria-expanded, SVG is hidden from screen readers (aria-hidden="true"), button text/title is primary semantic content                      | —                                                      | unit-rtl | high   |
| Screen reader semantics - secondary chevron (line 106-115) | button has aria-label describing action (Expand/Collapse + title), SVG is hidden from screen readers (aria-hidden="true")                                                     | —                                                      | unit-rtl | high   |

### `apps/web/src/components/report-shell/meta-row.tsx`

_Added role="group" to root container div and role="img" to lock emoji span for semantic a11y compliance_  
Existing test: `apps/web/src/components/report-shell/report-shell.test.tsx`

| Block                                                                  | DOM assertion                                                                       | Interaction | Type     | Pri    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| root container div                                                     | div has role="group"                                                                | —           | unit-rtl | high   |
| root container div with ariaLabel prop                                 | div with role="group" has aria-label attribute matching ariaLabel prop              | —           | unit-rtl | high   |
| root container div accessibility tree                                  | div is accessible via getByRole('group') with aria-label                            | —           | unit-rtl | high   |
| foreign indicator span (lock emoji)                                    | span rendering 🔒 has role="img"                                                    | —           | unit-rtl | high   |
| foreign indicator span aria-label                                      | span with role="img" has aria-label="Read-only — authored by another lead"          | —           | unit-rtl | high   |
| foreign indicator span only when foreign=true AND authorName is truthy | img role span is present only when foreign && authorName, absent when foreign=false | —           | unit-rtl | high   |
| foreign indicator accessibility tree                                   | span with role="img" is accessible and contributes to accessibility tree            | —           | unit-rtl | medium |
| render with ariaLabel prop                                             | group role container receives aria-label when ariaLabel prop is provided            | —           | unit-rtl | high   |
| render without ariaLabel prop                                          | group role container has no aria-label when ariaLabel prop is undefined             | —           | unit-rtl | medium |
| snapshot: root structure with role group                               | root div renders with role="group" and all child structure intact                   | —           | snapshot | medium |
| snapshot: foreign indicator with role img                              | foreign indicator span renders with role="img" when foreign=true                    | —           | snapshot | medium |

### `apps/web/src/components/report-shell/scope-toggle.tsx`

_Added biome-ignore comment and wrapped map callback in explicit function body; no DOM/a11y/behavior changes_  
Existing test: `apps/web/src/components/report-shell/scope-toggle.test.tsx`

| Block                                   | DOM assertion                                                                                      | Interaction                                               | Type     | Pri    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ------ |
| button role="radio" structure           | each scope renders as button with role="radio"                                                     | —                                                         | unit-rtl | high   |
| button type attribute                   | each button has type="button"                                                                      | —                                                         | unit-rtl | high   |
| aria-checked attribute for active scope | active scope button has aria-checked="true", inactive scopes have aria-checked="false"             | —                                                         | unit-rtl | high   |
| stable key prop                         | each scope button has key={s} matching its ScopeValue                                              | —                                                         | unit-rtl | medium |
| radio button click handler              | clicking a scope button fires onChange with the correct ScopeValue                                 | click scope button → onChange invoked with matching value | unit-rtl | high   |
| radiogroup container                    | parent div has role="radiogroup" and aria-label="Slide scope"                                      | —                                                         | unit-rtl | high   |
| filtered allowedScopes rendering        | only scopes in allowedScopes array render as buttons                                               | —                                                         | unit-rtl | high   |
| default allowedScopes fallback          | when allowedScopes prop omitted, all three scopes (own, product, lead) render                      | —                                                         | unit-rtl | high   |
| button text labels                      | button text content matches LABELS mapping ("Own", "By product", "By lead")                        | —                                                         | unit-rtl | medium |
| visual state class application          | active scope button has primary background+white text; inactive scopes have muted foreground color | —                                                         | snapshot | medium |

### `apps/web/src/components/search/search-input.tsx`

_Removed aria-label from badge span element; badge still renders visible text (Task/Risk/Decision/Product) but no longer has redundant aria-label attribute_  
Existing test: `apps/web/src/components/search/search-input.test.tsx`

| Block                         | DOM assertion                                                                                                     | Interaction | Type     | Pri    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| badge span element (line 264) | span.badge has no aria-label attribute                                                                            | —           | snapshot | high   |
| badge span element (line 264) | span has class 'inline-flex' and renders badge.label text ('Task'/'Risk'/'Decision'/'Product') as visible content | —           | unit-rtl | high   |
| search result item type badge | rendered badge span element contains the correct text for hit type (e.g., 'Task' for item, 'Product' for project) | —           | unit-rtl | medium |
| search results hit structure  | badge span element is a direct child of the flex container on line 263 with correct class structure intact        | —           | snapshot | medium |

### `apps/web/src/components/slides/lead-unified-slide.tsx`

_Removed redundant aria-label from product marker span; added role="img" to priority chip span for proper semantic a11y._  
Existing test: —

| Block                                | DOM assertion                                                                                 | Interaction | Type     | Pri    |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| inlineProductMarker span wrapper     | span should not have aria-label attribute (only title attribute present)                      | —           | unit-rtl | high   |
| inlineProductMarker span wrapper     | span should have title={productName} attribute set                                            | —           | unit-rtl | high   |
| priorityChip span                    | span should have role="img" attribute                                                         | —           | unit-rtl | high   |
| priorityChip span                    | span with role="img" should have aria-label={`Priority ${rank}`} attribute                    | —           | unit-rtl | high   |
| priorityChip span                    | span should have title attribute with text "Priority rank {rank}"                             | —           | unit-rtl | medium |
| LeadUnifiedSlide rendered list items | each li should contain a span with role="img" when priorityRank is present                    | —           | unit-rtl | medium |
| LeadUnifiedSlide rendered list items | each product marker span should not expose aria-label to screen readers (only title fallback) | —           | unit-rtl | medium |
| priorityChip semantic structure      | span with role="img" and aria-label should render as img equivalent in accessibility tree     | —           | snapshot | medium |

### `apps/web/src/components/slides/slide-skeleton.tsx`

_Root container now has role="status" for a11y; skeleton-list loop now uses stable numeric array instead of Array.from with index-based keys_  
Existing test: —

| Block                   | DOM assertion                                                                                              | Interaction | Type     | Pri    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| root container          | div has role="status"                                                                                      | —           | unit-rtl | high   |
| root container          | div has aria-busy="true"                                                                                   | —           | unit-rtl | high   |
| root container          | div has aria-label="Loading slides"                                                                        | —           | unit-rtl | high   |
| root container          | div has class "space-y-5"                                                                                  | —           | unit-rtl | medium |
| skeleton-list map       | renders exactly 4 skeleton divs in the hidden lg:block container                                           | —           | unit-rtl | high   |
| skeleton-list map       | each skeleton div has key prop matching its numeric value (0, 1, 2, 3)                                     | —           | snapshot | high   |
| skeleton-list map       | each skeleton div has class "h-24 animate-pulse rounded-[var(--radius)] bg-[var(--color-muted)]"           | —           | unit-rtl | medium |
| skeleton-list container | skeleton divs are in a div with class "hidden space-y-2 lg:block"                                          | —           | unit-rtl | medium |
| main skeleton area      | large skeleton div (h-[460px]) is in a grid with class "grid gap-5 lg:grid-cols-[minmax(220px,300px)_1fr]" | —           | unit-rtl | medium |

### `apps/web/src/components/weekly-report/period-navigator.tsx`

_Added aria-hidden="true" to ChevronLeft and ChevronRight SVGs; added biome-ignore comment for useSemanticElements on container div_  
Existing test: `apps/web/src/components/weekly-report/period-navigator.test.tsx`

| Block                                      | DOM assertion                                                                                      | Interaction | Type     | Pri    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| ChevronLeft SVG aria-hidden attribute      | ChevronLeft SVG has aria-hidden="true"                                                             | —           | unit-rtl | high   |
| ChevronRight SVG aria-hidden attribute     | ChevronRight SVG has aria-hidden="true"                                                            | —           | unit-rtl | high   |
| Previous button with decorative chevron    | Previous button contains SVG with aria-hidden="true" (decorative icon not exposed in a11y tree)    | —           | unit-rtl | high   |
| Next button with decorative chevron        | Next button contains SVG with aria-hidden="true" (decorative icon not exposed in a11y tree)        | —           | unit-rtl | high   |
| Period navigation container role and label | Container div has role="group" and aria-label="Period navigation (swipe left/right or use arrows)" | —           | unit-rtl | medium |
| Previous button accessibility attributes   | Previous button has type="button", title="Previous week", and aria-label="Previous week"           | —           | unit-rtl | medium |
| Next button accessibility attributes       | Next button has type="button" and aria-label="Next week"                                           | —           | unit-rtl | medium |
| Select element accessibility               | select element has aria-label="Select reporting period"                                            | —           | unit-rtl | medium |
| Chevron icon rendering in previous button  | Previous button renders ChevronLeft with aria-hidden SVG (icon invisible to screen reader)         | —           | snapshot | medium |
| Chevron icon rendering in next button      | Next button renders ChevronRight with aria-hidden SVG (icon invisible to screen reader)            | —           | snapshot | medium |

### `apps/web/src/components/weekly-report/portfolio-overview-table.tsx`

_Added aria-hidden="true" to GridIcon SVG for proper accessibility — decorative icon is now hidden from screen readers_  
Existing test: —

| Block                                         | DOM assertion                                                                                                                                                       | Interaction | Type     | Pri    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| GridIcon SVG element                          | svg element has aria-hidden="true" attribute                                                                                                                        | —           | unit-rtl | high   |
| GridIcon SVG accessibility tree inclusion     | svg with aria-hidden="true" is not accessible to screen reader (excluded from a11y tree)                                                                            | —           | unit-rtl | high   |
| Portfolio Overview table header with GridIcon | header contains visible GridIcon SVG but SVG has aria-hidden="true"; heading text 'Portfolio Overview' is read by screen reader without redundant icon announcement | —           | unit-rtl | high   |
| GridIcon visual rendering                     | svg renders 4 rect elements with correct viewBox and styling; decorative icon visually appears next to 'Portfolio Overview' text                                    | —           | snapshot | medium |

### `apps/web/src/components/weekly-report/product-accordion.tsx`

_Added aria-hidden="true" to decorative ChevronDown SVG; simplified priorities list key from composite (rank+index) to rank alone; removed unused idx parameter_  
Existing test: —

| Block                                                | DOM assertion                                                                                                                                                              | Interaction                                                   | Type     | Pri    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- | ------ |
| ChevronDown SVG aria-hidden attribute                | svg element has aria-hidden="true"                                                                                                                                         | —                                                             | unit-rtl | high   |
| ChevronDown SVG stroke and path rendering            | svg with viewBox="0 0 24 24" contains path with d="M6 9l6 6 6-6" and stroke-width={2}                                                                                      | —                                                             | snapshot | medium |
| ChevronDown rotation transform expanded state        | svg has transform="rotate(0deg)" when expanded=true, transform="rotate(-90deg)" when expanded=false                                                                        | —                                                             | unit-rtl | high   |
| Accordion button chevron visibility for empty report | when hasContent=false, placeholder span with aria-hidden="true" renders instead of ChevronDown                                                                             | —                                                             | unit-rtl | medium |
| Priorities list items DOM key stability              | each li in priorities ol has key={p.rank}, no key includes idx suffix                                                                                                      | —                                                             | unit-rtl | high   |
| Priorities list render with multiple items same rank | ol renders all priorities items even if two priorities share rank (no React key collision removal)                                                                         | —                                                             | unit-rtl | medium |
| Priorities list item styling for rank=1              | li with p.rank===1 has style.background="#faf6ee"; other li have style.background="var(--color-background)"                                                                | —                                                             | unit-rtl | medium |
| Priorities list item rank number badge styling       | span inside li has background var(--color-starbucks-gold) and color #fff when p.rank===1; otherwise background var(--color-border) and color var(--color-muted-foreground) | —                                                             | unit-rtl | medium |
| Priorities ol semantic structure                     | priorities section renders ol element (not ul/div) with correct nesting of li children                                                                                     | —                                                             | snapshot | high   |
| Accordion expand/collapse with priorities present    | when expanded=true, priorities ol is visible inside grid with gridTemplateRows="1fr"; when expanded=false, gridTemplateRows="0fr" hides content                            | Tab to accordion button, press Enter to toggle expanded state | unit-rtl | high   |
| ChevronDown SVG class list                           | svg has className containing h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300                                                                | —                                                             | snapshot | low    |
| Priorities paragraph count display                   | ol parent div shows heading "Top Priorities" with class text-[var(--color-starbucks-gold)]                                                                                 | —                                                             | unit-rtl | low    |

### `/home/user/work/customreport/apps/web/src/components/weekly-report/weekly-report-skeleton.tsx`

_Added role="status" to root skeleton container for semantic a11y compliance_  
Existing test: `/home/user/work/customreport/apps/web/src/components/weekly-report/weekly-report-skeleton.test.tsx`

| Block                                                       | DOM assertion                                                                                  | Interaction | Type     | Pri    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| WeeklyReportSkeleton root element role attribute            | root div has role="status"                                                                     | —           | unit-rtl | high   |
| WeeklyReportSkeleton aria attributes on status root         | element with role="status" has aria-busy="true" and aria-label="Loading status report"         | —           | unit-rtl | high   |
| WeeklyReportSkeleton root DOM structure with status role    | root element with role="status" has class="space-y-4" and data-testid="weekly-report-skeleton" | —           | unit-rtl | medium |
| WeeklyReportSkeleton semantic role accessibility tree       | screen reader exposes element as status region with aria-busy and aria-label accessible names  | —           | snapshot | medium |
| WeeklyReportSkeleton role preservation in getByRole queries | element is found by screen.getByRole("status", { name: /loading status report/i })             | —           | unit-rtl | high   |

### `/home/user/work/customreport/apps/web/src/styles/app.css`

_CSS @source directives reordered to appear after @import statements, changing Tailwind v4 content scanner resolution order; no DOM/a11y/behavior changes in this stylesheet-only file_  
Existing test: —

| Block | DOM assertion | Interaction | Type | Pri |
| ----- | ------------- | ----------- | ---- | --- |

### `/home/user/work/customreport/packages/shared/src/schemas/report-primitives.schema.ts`

_Regex pattern refactored from character class `/[\s​‌‍﻿]/g` to alternation `/\s\|​\|‌\|‍\|﻿/gu` in `noInvisibleOnly` validator for Biome linting; behavior is functionally identical._  
Existing test: `/home/user/work/customreport/packages/shared/src/schemas/report.test.ts`

| Block                                                              | DOM assertion                                                                                                           | Interaction | Type     | Pri    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------ |
| noInvisibleOnly — whitespace-only string rejection                 | safeText validator rejects spaces-only strings (empty after regex.replace)                                              | —           | unit-rtl | high   |
| noInvisibleOnly — single visible character acceptance              | safeText validator accepts single non-whitespace character                                                              | —           | unit-rtl | high   |
| noInvisibleOnly — zero-width space ​ rejection                     | safeText validator rejects string containing only ​ (zero-width space)                                                  | —           | unit-rtl | high   |
| noInvisibleOnly — zero-width non-joiner ‌ rejection                | safeText validator rejects string containing only ‌ (zero-width non-joiner)                                             | —           | unit-rtl | high   |
| noInvisibleOnly — zero-width joiner ‍ rejection                    | safeText validator rejects string containing only ‍ (zero-width joiner)                                                 | —           | unit-rtl | high   |
| noInvisibleOnly — zero-width no-break space ﻿ rejection            | safeText validator rejects string containing only ﻿ (zero-width no-break space/BOM)                                     | —           | unit-rtl | high   |
| noInvisibleOnly — mixed whitespace rejection                       | safeText validator rejects tabs, newlines, carriage returns, and spaces-only strings                                    | —           | unit-rtl | high   |
| noInvisibleOnly — mixed invisible characters rejection             | safeText validator rejects strings with only combination of whitespace and zero-width characters                        | —           | unit-rtl | high   |
| noInvisibleOnly — visible text with embedded whitespace acceptance | safeText validator accepts text with visible characters and internal whitespace (e.g., 'hello world')                   | —           | unit-rtl | high   |
| noInvisibleOnly — Unicode-aware surrogate pair handling            | safeText validator correctly processes multi-byte Unicode characters (emoji, mathematical alphanumerics) with /gu flags | —           | unit-rtl | medium |
| noInvisibleOnly — visible character at string boundary             | safeText validator accepts strings with visible chars after/before invisible characters (e.g., 'a ​' → truthy)          | —           | unit-rtl | medium |
| itemInputSchema.text — via safeText validation                     | item text field rejects invisible-only strings at Zod validation layer                                                  | —           | unit-rtl | high   |
| riskInputSchema.description — via safeText validation              | risk description field rejects invisible-only strings at Zod validation layer                                           | —           | unit-rtl | high   |
| riskInputSchema.impact — via safeText validation                   | risk impact field rejects invisible-only strings at Zod validation layer                                                | —           | unit-rtl | high   |
| riskInputSchema.mitigation — via safeText validation               | risk mitigation field rejects invisible-only strings at Zod validation layer                                            | —           | unit-rtl | high   |
| decisionInputSchema.title — via safeText validation                | decision title field rejects invisible-only strings at Zod validation layer                                             | —           | unit-rtl | high   |
| decisionInputSchema.rationale — via safeText validation            | decision rationale field rejects invisible-only strings at Zod validation layer                                         | —           | unit-rtl | high   |

### `packages/ui/src/components/data-table.tsx`

_Added biome-ignore comment on TableRow render (line 157); no runtime/DOM changes, purely lint suppression_  
Existing test: —

| Block                                          | DOM assertion                                                                                            | Interaction                                                  | Type     | Pri    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- | ------ |
| TableRow key={index} with biome-ignore comment | TableRow element renders with key attribute bound to array index without error or missing key warning    | —                                                            | unit-rtl | high   |
| sortedData.map body with comment preserved     | Each row in table body renders with data from sorted array in correct order                              | —                                                            | unit-rtl | high   |
| onRowClick handler on TableRow with index key  | Clicking row triggers onRowClick callback with correct row data regardless of array index key            | click a table row → onRowClick fires with correct row object | unit-rtl | medium |
| Table rendering without linter errors          | Component renders without console errors or warnings related to keys                                     | —                                                            | unit-rtl | medium |
| DOM snapshot of table rows with comment        | DOM structure, class names, and all attributes on TableRow remain unchanged from before comment addition | —                                                            | snapshot | high   |
