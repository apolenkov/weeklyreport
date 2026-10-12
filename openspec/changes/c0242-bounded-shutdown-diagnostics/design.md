# Design

`reportTerminal(line)` calls `writeSync(process.stderr.fd, line)` inside a
`try`/`catch` that swallows the error. Reading `process.stderr.fd` makes Node
open the stream lazily; on POSIX that runs `uv_pipe_open`, which sets
`O_NONBLOCK`, so a full pipe raises `EAGAIN` instead of blocking. This is a
source-level fact (libuv `pipe.c`, Node `lib/net.js` forces blocking stdio only
on Windows) and still needs a native receipt: a unit test cannot show that a
real write to a full pipe fails rather than blocks.

Alternatives rejected: awaiting the write callback (the drain-failure path has
no deadline, so a stalled reader would hang the process), and an extra timer
(it adds a second exit path).

Delivery is best-effort by design: no bounded mechanism can place bytes into a
full pipe whose reader waits for exit, and the hard exit bound outranks the
diagnostic.
