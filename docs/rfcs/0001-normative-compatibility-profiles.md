# RFC-0001: normative compatibility profiles

Status: **implemented**

## Decision

NativR targets versioned, browser-admissible behavioral compatibility with **GNU R 4.6.1**. The
machine-readable source of truth is
[`compatibility/profiles.json`](../../compatibility/profiles.json). The exact `r-4.6.1` profile
gates releases. `r-4.6.1-patched` and `r-devel` are advisory profiles and must not silently redefine
NativR behavior.

“Complete GNU R compatibility” is not used without qualification. The browser cannot honestly
provide an ambient host process, unrestricted filesystem, host pointers, or dynamic libraries. Such
surfaces must either use a documented browser adaptation or fail explicitly at a capability
boundary. They are not silently ignored.

## Pure-R completion gate

A pure-R package is compatible only when its pinned, unmodified source release and complete pinned
dependency closure can be packaged, namespace-loaded, attached, and exercised at a declared
validation tier without package-specific NativR implementation code. Unsupported host capabilities
must fail explicitly.

## Version identifiers

- `nativrVersion`: npm release version.
- `protocolVersion`: Worker wire compatibility.
- `semanticProfileVersion`: NativR semantic-capability revision.
- `targetRVersion`: normative GNU R behavior target.
- `capabilityManifestHash`: generated identity of the exact reported surface.

`languageSubsetVersion` remains a protocol-v1 alias of `semanticProfileVersion` until a future
protocol revision can remove it.

## Upgrade rule

A new GNU R release becomes normative only through an explicit change to the profile, regenerated
oracle evidence, package-corpus results, and release-gating review. CI must never use `release` as
the normative selector.
