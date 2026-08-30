# Follow-up milestones

## 1. Provenanced static data

- Define the GIlore HSR extraction package and its upstream license review.
- Generate matched `en` and `zh-CN` text bundles keyed by stable IDs.
- Add Character, Light Cone, Relic set, Path, Combat Type, and stat archives.
- Verify entity-ID parity, checksums, and exact upstream revisions in CI.

## 2. Scanner import workflow

- Coordinate the versioned scanner envelope with the scanner project.
- Add local file selection, size limits, parse progress, coverage warnings, and
  review-before-apply behavior.
- Test replace/merge semantics and guarantee failure causes no store mutation.

## 3. Build workspace UX

- Add profile editors for build targets, stat weights, set requirements,
  computed filters, and triage thresholds.
- Add score explanation and filter previews without making authoritative
  damage or character-value claims.
- Validate dense desktop and narrow mobile interaction states.

## 4. HoYoLAB adapter

- Confirm current, permitted upstream contracts for global and CN regions.
- Design a request boundary that never stores or logs cookie material.
- Add strict response schemas, safe error codes, abort behavior, and marker
  credential tests before connecting UI.

## 5. Backup and infrastructure

- Add local backup import/export UI first.
- Introduce authentication or cloud backup only after an explicit product and
  threat-model decision.
- Provision independent Worker resources through reviewed configuration; never
  reuse GenshinTools accounts, IDs, buckets, databases, routes, or secrets.

Deployment, a GitHub remote, and production infrastructure are not milestones
completed by this foundation.
