## REMOVED Requirements

### Requirement: WeeklyReport MUST have one owned browser acceptance contour

**Reason**: The owner retired the separate browser acceptance platform.

**Migration**: Keep verification colocated with product modules.

### Requirement: Browser acceptance MUST remain smoke-only

**Reason**: The replacement smoke is deleted with the harness.

**Migration**: Use focused product tests and human product review when needed.

### Requirement: Acceptance complexity and duration MUST be bounded

**Reason**: The acceptance source tree and its numeric budget gate are deleted.

**Migration**: Apply strict structural limits to product source, not test infrastructure.

### Requirement: Standard Playwright evidence MUST be sufficient

**Reason**: No Playwright test runner remains.

**Migration**: Ordinary test output and product review evidence remain sufficient for their owning product slice.

### Requirement: Disposable state and cleanup MUST fail closed

**Reason**: The browser acceptance lifecycle that owned destructive setup and cleanup is deleted.

**Migration**: Existing product-adjacent database tests and operations retain their exact destructive guards.

### Requirement: Acceptance MUST be rerunnable from the beginning

**Reason**: No browser acceptance run remains.

**Migration**: Product-adjacent tests remain independently rerunnable under their own contracts.
