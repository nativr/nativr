# ADR 0005: Apache-2.0 and clean-room contribution

- Status: accepted
- Date: 2026-07-28

## Context

R and many packages are copyleft, while NativR intends a permissive independent implementation.

## Decision

License original NativR work under Apache-2.0, use permissive dependencies after review, and require
documented clean-room behavioral evidence for compatibility work.

## Alternatives considered

GPL inheritance through copied code, unspecified licensing, and accepting mechanically translated
package implementations.

## Consequences

Contributors must disclose sources and reviewers must inspect provenance. Some apparent shortcuts
are prohibited even when technically convenient.
