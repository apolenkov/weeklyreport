## Why

The Users table presents destructive Delete beside routine row actions on 34px targets, while slide decks can overfill a projection view. These P2 findings reduce safety and presentation legibility.

## What Changes

- Keep Edit and Activate/Deactivate inline; move Delete into an overflow menu or the edit dialog's explicit danger zone.
- Raise Users-table interactive targets to at least 40px without making the row visually dominant.
- Add a presentation-density mode that pages slides by product and caps records per view while preserving access to all content.

## Capabilities

### New Capabilities

- `admin-user-management-ux`: Safe action hierarchy and minimum target sizes for user administration.

### Modified Capabilities

- `lead-slide-by-product-grid`: Product cards gain presentation-density pagination.

## Impact

Touches Users table/edit UI, shared menu/dialog primitives as needed, slide model/deck controls, pagination, tests, and catalog/visual scenarios. User lifecycle and slide content semantics remain unchanged. It follows `sweep15-slide-status-accessible-label` and does not duplicate that P1 contract/implementation.

## Non-goals

- No change to who may delete, activate, or deactivate users.
- No record truncation or loss; density mode paginates all content.
- No global redesign of admin tables.
- No slide product-status icon/text work; `sweep15-slide-status-accessible-label` owns it.
