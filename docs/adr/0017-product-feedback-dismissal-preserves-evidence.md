# Product feedback dismissal preserves evidence

**Status:** accepted for the authenticated product-feedback workbench.

`Dismiss` is never physical deletion through WeeklyReport's product UI. It is a
confirmed `dismissed` lifecycle transition with a reason, preserving the
original annotation, authenticated author, thread, and captured evidence.
Separately, an admin may explicitly confirm deletion of exactly one visible item
from either source. Agentation keeps its session while stored annotation events
are removed explicitly and annotation/thread children cascade; legacy
ProductFeedback children cascade. Bulk deletion remains unavailable. This keeps
routine dismissal auditable while making intentional cleanup possible for the
admin.
