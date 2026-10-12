# Team analysis workspace

`/team-damage/analysis?team=<id>&mode=<mode>` is the canonical route. The old
optimizer, investment and choice URLs redirect to the corresponding mode.
Internal navigation uses the canonical route.

The workspace mounts one team roster and one battle setup above five modes:
Relics, Builds, Investment, Characters and Rotation. Visited team mode bodies
stay mounted when switching modes or returning to the team grid. Only the active
team launches automatic simulation; requests already running may finish while
hidden. Each explicit analysis run owns its cancellation scope.

Relics uses the existing relic optimization and native simulation. Builds uses
the existing per-member Light Cone and relic-set comparison. Investment keeps
the existing per-member paths and their combined-order heuristic: Next copies
is a prefix of that same result, not a second engine or a claim of globally
optimal joint investment. Characters exposes supported replacement settings;
its principal calculation remains disabled until the backend supports the
search. Rotation shows the shared native combat timeline, including energy and
SP; this workspace adds no separate energy algorithm.

Roster rank defaults resolve owned Light Cone copies in descending S order,
deduplicated by physical inventory key. A missing copy defaults to S1; missing
characters default to E0. Explicit authored E/S overrides remain authoritative.
Account and 5-star E0/S1 shortcuts update those same shared roster inputs.

## Persistence boundary

The local `ggstarrail:teams` Zustand store is the only current carrier of team
plans. Workspace backups and cloud snapshots do not carry teams, so this change
does not extend those formats. Local envelope and body versions both move from
1 to 2 in `stores/migration/team.ts`.

Version 1 stored `{schemaVersion:1, teams, activeTeamId}`. Every selected Light
Cone had an explicit S; the migration preserves every authored rank, options,
member slot and battle setting. Version 2 adds optional `analysisByTeamId` mode
and investment ceiling/budget/crit settings. New selected Light Cones may omit S
to request account defaults; old explicit values are not converted. Known
malformed data uses the existing empty-store recovery; unknown future versions
are rejected without rewriting their envelope. Public hydration tests cover
both migration and reload of the added settings. Derived combat caches are
session-only and their keys include resolved account/plan inputs.
