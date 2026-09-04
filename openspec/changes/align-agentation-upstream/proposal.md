## Why

WeeklyReport uses the stock Agentation widget and MCP client but owns an HTTP
adapter. Dependency updates must be checked against public behavior rather than
bundle formatting, and every retained protocol deviation needs an explicit
product requirement. Reusing unsupported internals would increase upgrade risk.

## What Changes

- Audit each adapter concern against the installed public upstream surface.
- Replace demonstrated duplication only through supported public APIs.
- Replace bundle-text compatibility checks with public type and executable
  consumer contracts; exercise the stock MCP client against the real adapter.
- Record unavoidable exceptions and a reproducible dependency-upgrade gate.

## Impact

Feedback integration, tests, and its specification only. No dependency fork,
private imports, database migration, change of storage, production enablement,
or relaxation of WeeklyReport identity and deletion requirements.
