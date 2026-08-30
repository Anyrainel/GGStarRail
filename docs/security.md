# Security and import boundaries
bounded error codes so redaction is defense in depth rather than the primary
control.
## Authentication-cookie invariant

HoYoLAB authentication-cookie material is an ephemeral request input, not app
data. It must never enter:

- localStorage, sessionStorage, IndexedDB, or Zustand persistence;
- backup/export envelopes or imported-file diagnostics;
- URLs, analytics, telemetry, console output, or copied error details;
- Worker logs, bindings, environment examples, or provider results.

`EphemeralAuthMaterial` exposes a single asynchronous consumption boundary,
clears its private value in `finally`, renders as `[REDACTED]`, and converts
provider failures to a bounded safe code. Store and backup layers are forbidden
from importing that module. Regression tests enforce the dependency boundary,
scan for storage/logging calls, and use a marker credential to verify that
failures and serialization do not disclose it.

The network transport is intentionally absent. When implemented, global and CN
HoYoLAB contracts should be separately versioned, requests and responses must
not be logged, and failures must not mutate the workspace.

## File imports

Scanner imports validate the outer format and canonical account snapshot with
Zod. A recursive guard rejects credential-shaped field names before parsing.
Future file-size, checksum, and partial-coverage checks belong in the adapter,
before any store action.

## Diagnostics

The application error boundary shows a localized recovery hint plus sanitized
technical details. Diagnostic redaction covers cookie/token labels, JWT-shaped
values, and long hex values. Credential-adjacent providers should still throw
bounded error codes so redaction is defense in depth rather than the primary
control.
