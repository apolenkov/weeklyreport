# Design

`IfRole` reads `useQuery(auth.me)`. The fallback is shown only when the query is
pending without data (`me.isPending`). Error and loaded states keep the current
behaviour. The placeholder is a `role="status"` span with the text "Checking
reminder settings…" in `text-xs` muted colour, so the alert row keeps its height.
