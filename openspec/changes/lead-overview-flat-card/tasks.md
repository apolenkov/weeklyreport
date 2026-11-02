## 1. Remove drag and drop

- [ ] 1.1 Delete the drag handle, `useCardDrag`, the DnD context and lane droppable; drop `@dnd-kit/core` if unused
- [ ] 1.2 Tests and e2e no longer drag; Alt+Arrow and icon moves keep their coverage

## 2. Flat action row

- [ ] 2.1 Card grid with a reserved actions column; opacity reveal on hover, focus-within and open control; always visible without hover
- [ ] 2.2 Row holds Edit, week move, Stage (Product) and Plan/Restore; overflow menu deleted
- [ ] 2.3 Status menu ends with the outcome entry; "Update status" removed
- [ ] 2.4 Stage popover with owned stages as checkboxes, one draft patch per toggle

## 3. Dialog editor and creation

- [ ] 3.1 Create and edit render the canonical editor inside a modal dialog; the grid keeps its height
- [ ] 3.2 Only the unit header Add item creates; cell, row and per-week mobile `+` removed
- [ ] 3.3 Focus: create save lands on the new item, edit and cancel return to the trigger

## 4. Colour and sections

- [ ] 4.1 Solid primary focus outline and accent hover border on card controls
- [ ] 4.2 Unit group left bars and column header lines from existing tokens

## 5. Verify

- [ ] 5.1 Six gates green
- [ ] 5.2 Browser on lane A at 1280 and 375 (hover:none): no layout shift, keyboard pass, dialog create/edit, screenshots in handoffs
