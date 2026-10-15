## ADDED Requirements

### Requirement: Shared write inputs require content outside default-ignorable characters

Shared required-text write inputs, including report stage names, MUST reject empty strings and strings containing only ECMAScript whitespace or Unicode `Default_Ignorable_Code_Point`, including reserved points in that property. Reserved non-DICP points MUST NOT be added to this set. Existing null-byte rejection, length bounds, optionality and validation messages MUST remain effective.

#### Scenario: Residual default-ignorable content cannot satisfy a new write

- **WHEN** a shared write input contains only LRM/RLM, bidi controls, Hangul fillers, Khmer signs, variation selectors, tags, shorthand or musical format characters from the DICP property
- **THEN** validation rejects the value with its existing required-content message
- **AND** repetition or addition of ECMAScript whitespace does not make the value valid

#### Scenario: Reserved membership follows the property

- **WHEN** a required-text write receives only reserved DICP points such as U+2065 or U+E0000
- **THEN** validation rejects it
- **AND** reserved non-DICP U+0378 is not classified as blank by this rule

#### Scenario: Write stage names use the same content policy

- **WHEN** a report write supplies a stage name consisting only of U+3164 and whitespace
- **THEN** stage-name validation rejects that name
- **AND** array cardinality and optional write-array rules remain unchanged

### Requirement: Default-ignorable validation preserves successful write strings

Shared write validation MUST return each successful input string exactly as received, including whitespace, DICP characters, combining sequences, emoji and directionality controls. It MUST NOT strip, trim or normalize input. A code point outside whitespace and DICP satisfies this content rule; other existing validation rules still apply.

#### Scenario: Multilingual and emoji formatting remains intact

- **WHEN** otherwise valid text contains Arabic with ALM, Hebrew with bidi isolation, Persian with ZWNJ, a Mongolian letter with a selector, CJK with an ideographic selector, a variation-selector emoji, a ZWJ emoji or an emoji tag flag
- **THEN** parsing returns the exact input string, including all original formatting code points

#### Scenario: Existing rejection rules are independent

- **WHEN** input containing content outside whitespace and DICP has a null byte or exceeds its caller's length bound
- **THEN** the corresponding existing validation rule still rejects it

### Requirement: Unicode-dependent content classification is versioned

The validation acceptance record MUST identify Node, its Unicode data version, and supported browser engine versions with their RegExp Unicode data versions or an explicitly unresolved status. Before adopting or upgrading an engine, the effective DICP sets MUST be compared with the approved baseline; an unresolved version or changed set MUST receive compatibility review before delivery.

#### Scenario: Engine upgrades do not silently change accepted input

- **WHEN** Node or a supported browser engine is introduced or upgraded
- **THEN** acceptance records identify its version and Unicode classification evidence
- **AND** changed DICP membership receives policy and stored-value compatibility review before delivery

### Requirement: Expanded write classification follows stored-read compatibility

Expanded DICP write rejection MUST be delivered only after TASK-503.104 and TASK-503.108 stored-read compatibility are in main. Existing stored report, carry-over and PDF strings MUST remain readable under the read contract owned by TASK-503.108. Expanded stored-value clearance MUST use the new property coverage rather than reuse TASK-503.104's selected-character scan.

#### Scenario: Existing filler-only content remains readable

- **GIVEN** stored report content contains U+3164 alone
- **WHEN** stricter new-write validation is delivered
- **THEN** reading, carry-over and PDF consumption remain governed by the compatible stored-read contract
- **AND** new writes of that value are rejected

#### Scenario: Stored stage-name reads are independent of new-write classification

- **GIVEN** TASK-503.108 read compatibility is in main and stored stage names contain U+3164 alone
- **WHEN** current report read models consume those stage names after the DICP write rule is expanded
- **THEN** reading succeeds and preserves the exact stored names under the stored-read contract
- **AND** new writes of the same names are rejected under the write contract

#### Scenario: Local clearance is scoped to the expanded set

- **WHEN** delivery readiness for expanded DICP validation is assessed
- **THEN** the acceptance record contains a separate expanded-set stored-value scan or explicit migration decision
- **AND** local results do not claim to establish production data safety
