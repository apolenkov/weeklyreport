# Spec Delta

## ADDED Requirements

### Requirement: Authorized PDF artifact responses declare a private no-storage cache policy

The authenticated `/pdfs/{jobId}.pdf` download handler MUST send `Cache-Control: private, no-store` before streaming an authorized artifact. The response MUST retain its PDF content type, attachment disposition, and completed-generation artifact bytes.

#### Scenario: Requester downloads a completed artifact

- **WHEN** an authenticated requester downloads their completed canonical PDF artifact
- **THEN** the response carries `Cache-Control: private, no-store`
- **AND** the response retains PDF content type, attachment disposition, and the authorized generation's bytes
