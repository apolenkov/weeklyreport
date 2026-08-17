## ADDED Requirements

### Requirement: Checked-in non-production policy supports offered built-in profile pairs

The checked-in development and example `AI_PROVIDER_ALLOWED_ORIGINS` configuration MUST include the exact normalized origins of the Groq generation and Jina embedding endpoints exposed by Settings → AI → Provider. The API MUST continue to apply the same explicit origin policy to every built-in and custom connection and MUST NOT infer approval merely because a profile is built in.

#### Scenario: Admin saves a Groq and Jina draft in development

- **WHEN** an administrator saves Groq generation with Jina embeddings using their fixed built-in endpoints in the checked-in development environment
- **THEN** `admin.aiProvider.save` accepts both origins for normal draft validation
- **AND** no provider capability request is sent during the save operation

#### Scenario: Deployment omits a built-in origin

- **WHEN** a deployment's explicit `AI_PROVIDER_ALLOWED_ORIGINS` value omits a selected built-in profile origin
- **THEN** `admin.aiProvider.save` rejects the draft before sending a credential or synthetic payload
