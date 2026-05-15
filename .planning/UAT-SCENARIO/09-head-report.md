# 09 — Head Weekly Report + Presentation (A34)

**Route:** `/head/report/[reportId]` | `/head/report/[reportId]/present`  
**Role:** head / admin

### HR.01 — Weekly report renders assembled sections

**Element:** `data-testid="weekly-report-page"` | main  
Steps: Navigate to `/head/report`. Expected: all leads' sections visible.  
Status: `[ ]`

### HR.02 — Present link navigates to /present route

**Element:** link or button pointing to `/head/report/<id>/present`  
Steps: Click presentation button. Expected: `data-testid="head-present-page"` renders.  
Status: `[ ]`

### HR.03 — Presentation prev/next buttons navigate sections (A34)

**Element:** `data-testid="present-prev"` and `data-testid="present-next"` | buttons  
Steps:

1. Navigate to `/head/report/<id>/present`.
2. Wait for sections to load.
3. Click "→" (next).

Expected: page scrolls to next section accordion; counter updates.  
Status: `[ ]`

### HR.04 — Keyboard navigation ← → works in presentation (A34)

**Element:** document keydown listener on ArrowLeft / ArrowRight  
Steps:

1. Navigate to `/head/report/<id>/present`.
2. Press ArrowRight key.

Expected: scrolls to next section; counter shows "2 / N".  
Status: `[ ]`

### HR.05 — Fullscreen toggle button (A34)

**Element:** `data-testid="present-fullscreen"` | button  
Steps: Click "Fullscreen". Expected: browser enters fullscreen; button text → "Exit fullscreen".  
Status: `[M]` (browser fullscreen requires manual verification)

### HR.06 — Section counter shows current / total (A34)

**Element:** `data-testid="present-counter"` | text  
Expected: "1 / N" where N = total section count.  
Status: `[ ]`

<!-- TODO(A38-1): add items for report PDF export, section visibility scoping,
     author filter, period selector, submission status badges. -->
