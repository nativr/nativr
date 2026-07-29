# ADR 0004: Worker-first execution

- Status: accepted
- Date: 2026-07-28

## Context

Parsing and evaluation can block the browser main thread, while tests and constrained hosts need a
direct path.

## Decision

Default to one module Worker per session with a versioned protocol. Provide lazy inline mode backed
by the identical RuntimeHost.

## Alternatives considered

Main-thread-only execution, SharedArrayBuffer as a baseline, two semantic engines, and a server.

## Consequences

Asset URLs and packaging need real browser tests. Without SharedArrayBuffer, timeout/interrupt may
terminate the Worker and reset state; the API reports this honestly.
