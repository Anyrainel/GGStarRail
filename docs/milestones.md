# Delivery status and follow-up milestones

## Completed: provenanced static data

- Define the GIlore HSR extraction package and its upstream license review.
- Generate matched `en` and `zh-CN` text bundles keyed by stable IDs.
- Add Character, Light Cone, Relic set, Path, Combat Type, and stat archives.
- Verify entity-ID parity, checksums, and exact upstream revisions in CI.

## Completed locally: scanner import workflow

- Coordinate the versioned scanner envelope with the scanner project.
- Add local file selection, parsing/error states, coverage warnings, and
  review-before-apply behavior.
- Test replace/merge semantics and guarantee failure causes no store mutation.
- Accept native, GOODScanner experimental v1/v2 and production v3, and
  interoperable Reliquary, HSR-Scanner, Kel, and Fribbels v4 inputs without
  inventing completeness. Production v3 complete achievement evidence
  authoritatively replaces completion while omission preserves it on merge.

## Completed locally: build workspace UX

- Add profile editors for build targets, stat weights, set requirements,
  computed filters, and triage thresholds.
- Allow configuration from the full HSR Character catalog without requiring an
  imported account; ownership remains an optional filter.
- Add score explanation and filter previews without making authoritative
  damage or character-value claims.
- Validate dense desktop and narrow mobile interaction states.

## Completed locally: public UID showcase adapter

- Use an allowlisted, GET-only Worker route with Enka raw as the primary
  provider and separately normalized MiHoMo raw as failover.
- Preserve provider TTL/rate-limit behavior and merge only showcased
  Characters plus their equipped Light Cones and Relics.
- Keep public UID coverage labeled showcase-only; it is not a full inventory
  source or an official HoYoverse API.

## Completed with a live-validation boundary: HoYoLAB adapter

- Global and CN browser contracts, source DTOs, safe result codes, one-use
  credentials, local Worker transport, fixtures, and UI are implemented.
- Authenticated success, minimum sufficient cookie fields, and signing
  omission tolerance still require an explicit user-authorized credential
  test. Do not remove the unverified label before that test.
- Interactive security verification remains user-completed in HoYoLAB or
  米游社; automating it is not a milestone.

## Remaining: backup and infrastructure

- Add local backup import/export UI first.
- Introduce authentication or cloud backup only after an explicit product and
  threat-model decision.
- Provision independent Worker resources through reviewed configuration; never
  reuse GenshinTools accounts, IDs, buckets, databases, routes, or secrets.

Deployment, a GitHub remote, and production infrastructure are not milestones
completed by this local application.
