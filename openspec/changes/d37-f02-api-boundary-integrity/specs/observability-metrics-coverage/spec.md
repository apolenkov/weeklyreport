# Spec Delta

## ADDED Requirements

### Requirement: Telemetry headline represents the latest visible settled publication

The leadership telemetry.summary onTimeRatio MUST describe submitted sections in the newest admitted scoped settled snapshot and MUST be null when its submitted denominator is zero or no snapshot exists. The numeric sparkline MUST remain compact, oldest-first and at most four points. Both values MUST derive from one scoped immutable snapshot window; an older eligible ratio MUST NOT replace the latest headline. The pooled Prometheus gauge denominator remains unchanged.

#### Scenario: Latest scoped publication has no submitted sections

- **WHEN** the newest scoped snapshot contains only draft sections while an older snapshot has submitted sections
- **THEN** onTimeRatio is null and the older numeric ratio remains only in the compact sparkline

#### Scenario: Latest scoped publication has eligible sections

- **WHEN** the newest scoped snapshot has submitted sections
- **THEN** its on-time ratio supplies the headline and the same window supplies the oldest-first sparkline
