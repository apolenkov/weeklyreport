## ADDED Requirements

### Requirement: Provider test feedback exposes one coherent result

Settings → AI → Provider MUST display Generation, Embeddings, and active-feature compatibility as distinct outcomes from the selected revision's persisted test result. The terminal operation message MUST describe the same top-level result as the latest durable execution and MUST NOT report a generic provider failure when provider lanes passed but feature compatibility is inconclusive or failed.

#### Scenario: Provider lanes pass and feature compatibility is inconclusive

- **WHEN** the selected revision reports passed Generation and Embeddings with inconclusive `lead-report-assistant` compatibility
- **THEN** the card displays both provider lanes as Passed and Feature compatibility as Inconclusive
- **AND** the terminal message says compatibility could not be determined and recommends retrying
- **AND** it does not say that the provider capability test failed

#### Scenario: Planner tool call fails after retry

- **WHEN** Generation contains a failed `planner_tool_call` capability with failure code `tool_use_failed`
- **THEN** the card identifies the Planner tool call as failed
- **AND** it does not label the failure as Authentication

#### Scenario: Current operation has feedback

- **WHEN** a save, test, activation, disable, restore, or discard operation has current feedback
- **THEN** that feedback remains primary over historical execution detail

#### Scenario: Active provider retains a completed passing execution

- **WHEN** the active revision's provider lanes, feature compatibility, top-level result, and latest execution are passed
- **THEN** the card reports that all required provider and feature checks passed
- **AND** it does not claim that the test produced an incomplete result
