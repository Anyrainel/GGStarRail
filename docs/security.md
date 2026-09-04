# Security and import boundaries

## Authentication-cookie invariant

HoYoLAB authentication-cookie material is an ephemeral request input, not app
data. It must never enter:

- localStorage, sessionStorage, IndexedDB, or Zustand persistence;
- backup/export envelopes or imported-file diagnostics;
- URLs, analytics, telemetry, console output, or copied error details;
- Worker logs, bindings, environment examples, or provider results.

`EphemeralAuthMaterial` accepts either a transient raw Cookie or an explicit
allowlist of six modern v2 fields. It exposes a single asynchronous consumption
boundary, clears its private value in `finally`, renders as `[REDACTED]`, and
converts provider failures to a bounded safe code. Only allowlisted cookie
names are sent by the Worker. Store and backup layers are forbidden from
importing that module. Regression tests enforce the dependency boundary, scan
for storage/logging calls, and use synthetic one-use material to verify that
failures and serialization do not disclose it.

Global and CN HoYoLAB contracts use separate routes, hosts, fingerprints, and
DS1 configuration. Requests and responses are never logged, Worker responses
are `no-store`, upstream bodies are not echoed on failure, and failed imports
do not mutate the workspace. Authenticated success remains explicitly
unverified without a user-authorized live credential test.

## File imports

Scanner imports validate the versioned outer format and canonical account
snapshot with Zod. GOODScanner experimental v1/v2, production v3, and
third-party v4 files use explicit adapters instead of weakening the canonical
schema. Production v3 achievement evidence additionally requires the exact
packet-capture source, a safe revision, complete coverage, normalized status,
sorted unique public IDs, and a match in the generated reference. A recursive
guard rejects credential-shaped field names before parsing. The UI produces a
review draft; only a separate apply action reaches the source-aware account
merge or confirmed replacement, so parse failures cannot mutate the store. A
different UID cannot merge, and an unknown identity requires an explicit user
choice. Partial sources cannot delete a richer scanner inventory; omitted
achievement evidence also preserves existing completion during a merge.

The triage manager export contains public visible Relic identity and observed
state only. Its three privacy literals forbid account identifiers, raw packets,
and server item identifiers. Unknown prior state is preserved as `null`; it is
never defaulted to false evidence. Before an instruction is actionable, the
scanner must bind its matcher to exactly one current visible Relic and verify
that both prior lock and discard states are known, fresh, and unchanged.
Equipped or ambiguously matched pieces remain preview-only. GGStarRail exports
review instructions and never claims that it changed the game.

## Diagnostics

The application error boundary shows a localized recovery hint plus sanitized
technical details. Diagnostic redaction covers cookie/token labels, JWT-shaped
values, and long hex values. Credential-adjacent providers should still throw
bounded error codes so redaction is defense in depth rather than the primary
control.
