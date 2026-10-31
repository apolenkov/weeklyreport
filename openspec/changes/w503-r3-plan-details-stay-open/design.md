# Design

`OutcomeDetails` keeps `open` in `useState`, initialised from
`fields.parent.kind === "unresolved"`, and updates it from the `toggle` event of
the `<details>`. The parent choice no longer feeds `open`.
