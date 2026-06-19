/**
 * lead-demo-feedback #91: the single anchor class shared by every
 * tooltip-anchored ComingSoon control (agent-review, lead version, lead
 * PDF-export, nav theme, nav language, admin holidays). Centring the badge
 * under the control (`left-1/2 -translate-x-1/2`) makes it sit identically
 * regardless of the control's width — the prior `right-0` right-aligned it, so
 * the wide text-labelled agent-review badge sat at a different offset than the
 * icon-only controls. The `group` parent + `group-hover` reveal stays on each
 * control; only this badge-positioning string is shared.
 *
 * NOTE: this anchors hover tooltips only. The inline (non-hover) integration
 * row badges in the admin integrations sub-tab are NOT tooltips and must not
 * use this class.
 */
export const COMING_SOON_TOOLTIP_ANCHOR =
  "pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-30 -translate-x-1/2 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";
