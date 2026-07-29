# ADR 0002: Tree-sitter parser and owned AST

- Status: accepted
- Date: 2026-07-28

## Context

R syntax requires a real grammar, but concrete parser nodes are an unstable implementation detail.

## Decision

Build the MIT tree-sitter-r grammar to Wasm with a pinned CLI and immediately normalize its tree
into dependency-free NativR AST nodes.

## Alternatives considered

Regex parsing, handwritten bootstrap grammar, exposing Tree-sitter nodes, and copying GNU R parser
code.

## Consequences

Parser assets require reproducible Wasm tooling and ABI tests. The evaluator is insulated from
grammar node-name changes and diagnostics retain NativR-owned spans/codes.
