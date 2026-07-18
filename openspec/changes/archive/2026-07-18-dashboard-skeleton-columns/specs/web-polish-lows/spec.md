## ADDED Requirements

### Requirement: Skeleton bar widths use a JIT-extractable class or inline style

Dashboard skeleton bars MUST express their width using either a literal
Tailwind class string that appears verbatim in source (e.g. via a static
lookup map), or an inline `style={{ width }}`. This governs
`DashboardSkeleton`
(`apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`), which MUST
NOT build a Tailwind width utility class via a runtime template-literal
interpolation (e.g. `` `w-[${w}px]` ``), because Tailwind's static JIT
scanner cannot extract a class name that only exists at runtime — the
utility is silently never generated, and the bar renders with zero width.

#### Scenario: Skeleton bars render with visible width

- **GIVEN** the dashboard is in its loading state
- **WHEN** `DashboardSkeleton` renders its header skeleton bars
- **THEN** each bar has a non-zero, visible width matching its intended
  value
- **AND** no bar's width class is constructed via a runtime
  template-literal interpolation
