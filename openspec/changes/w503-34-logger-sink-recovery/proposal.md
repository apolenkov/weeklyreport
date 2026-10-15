# Proposal

## Why

C0593: the local `LOG_DIR` file sink is cached per directory, and every logger
keeps the stream it got at construction. When an append fails, the fs stream
destroys itself, but the cache and each logger, including the shared
`APP_LOGGER` singleton, keep writing into it. `app.log` then stays silent until
restart, and `flush` rejects. stdout/stderr still carry every entry.

C0598: Nest's static shutdown and module-destroy hooks log
`Logger.error(err, err.stack)`. The adapter stores that second argument as
`nestContext`, so the Error's own stack is duplicated as a context.

## What Changes

- The sink registry reopens a destroyed stream on the next write. Loggers and
  their children resolve the sink per write instead of holding a stream.
- A configured `LOG_DIR` still fails closed when a logger is constructed. A
  reopen failure during a log call never throws; it writes one stderr line.
- `flush` settles the current stream's pending writes and does not reopen.
- The Nest adapter omits `nestContext` only when the second argument is exactly
  the Error's own stack and no third argument is given. Every other call shape
  is unchanged. No stack-format heuristic is added.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operational-logger-wiring`: add file-sink recovery and the Nest static error
  form.
