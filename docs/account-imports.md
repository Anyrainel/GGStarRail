# Account imports

The account-import contracts in this repository were checked against current
upstream implementations and deployed HSR web clients on 2026-09-02. Every
source is normalized into `AccountSnapshot` v2 before the review screen and
the same source-aware merge boundary is used by scoring, filters, build
recommendations, and triage.

## Coverage hierarchy

No website source is presented as a complete HSR inventory:

1. A public UID import reads only the Characters displayed in a profile and
   their equipped Light Cones and Relics. Enka raw is primary and MiHoMo raw is
   the independent failover.
2. HoYoLAB or 米游社 Battle Chronicle can return the signed-in account's
   Character roster and each Character's equipped gear. It does not return
   unequipped Light Cones or Relics.
3. Complete inventory coverage requires an explicitly complete scanner or
   packet-capture export. Reliquary packet capture is the preferred full-data
   source and Kel/HSR-Scanner OCR is the fallback when capture is unavailable.
   A source that reports unknown or partial coverage is never promoted to
   complete by GGStarRail.

Partial imports merge by stable source identity and visible equipped-item
identity. They do not delete richer locally imported inventory when a showcase
or Battle Chronicle response omits it. Empty or private showcase data remains
a valid partial result, distinct from a missing UID, rate limit, or upstream
failure.

Import review resolves account identity before writing. An empty workspace is
replaced directly, the same UID can merge, and a different UID requires an
explicit replacement confirmation. If either side has no UID, the identity is
unknown and the user must deliberately choose merge-as-the-same-account or a
confirmed replacement. This prevents UID-less demo or scanner data from being
silently mixed with a known account.

## Public UID

The browser calls the local Worker using only
`GET /api/enka/uid/{nine-digit-uid}`. The Worker allowlists that path, sends an
identifying user agent to Enka, preserves the raw payload and TTL, and can fall
back to MiHoMo raw without treating its DTO as an Enka response. There is no
force-refresh control and no claimed fixed request quota. Upstream 429 and
failure states remain actionable result codes.

Contract evidence:

- Enka HSR API policy and raw response:
  <https://github.com/EnkaNetwork/API-docs/blob/88d341fa734bc0554d62114775afc2b6696fc19c/api.md>
- current TypeScript provider behavior and raw normalization:
  <https://github.com/yuko1101/starrail.js/blob/792648b17909fdc1a9ae0de67040ae197d3b60f3/src/client/StarRail.ts>
  and
  <https://github.com/yuko1101/starrail.js/blob/792648b17909fdc1a9ae0de67040ae197d3b60f3/src/models/StarRailUser.ts>
- MiHoMo raw contract:
  <https://github.com/Mar-7th/March7th-Docs/blob/8240dd3b482048b94f30db51845ffd581fd3bac0/docs/en/api/raw.md>

These providers are reverse-engineered community services, not an official
arbitrary-UID HoYoverse API.

## Battle Chronicle credentials

The normal UI accepts a raw Cookie for one request. The provider also accepts
an explicit allowlist of the modern v2 fields: `cookie_token_v2`,
`account_mid_v2`, `account_id_v2`, `ltoken_v2`, `ltmid_v2`, and `ltuid_v2`.
The local Worker extracts only these names from raw input and sends only those
allowlisted pairs upstream. A device ID and device fingerprint are required
while the current browser request contract requires them.

Global and CN contracts are deliberately separate:

- Global web primary:
  `https://sg-act-public-api.hoyolab.com/event/game_record/hkrpg/api/avatar/info`
- CN web primary:
  `https://api-takumi-record.mihoyo.com/game_record/hkrpg/api/avatar/info`

Both use `role_id`, the UID-derived server, and `need_wiki=true`. Each request
uses its region's current browser fingerprint and DS1 salt; the CN browser
contract is not mixed with the embedded-app `/app` route or DS2 signing.
Fingerprint values are isolated so that an upstream change can be updated
without changing canonical account data.

The browser fingerprints implemented from the deployed 2026-09-02 bundles are:

- Global: `x-rpc-client_type: 5`, `x-rpc-app_version: 1.5.0`,
  `x-rpc-platform: 4`, language and device headers, and DS1 salt
  `6s25p5ox5y14umn1p61aqyyvbvvl3lrt`.
- CN: `x-rpc-client_type: 5`, `x-rpc-app_version: 2.3.0`,
  `x-rpc-platform: 4`, language and device headers, DS1 salt
  `h8w582wxwgqvahcdkpvdhbh2w9casgfl`, `x-rpc-page` prefixed by
  `v4.5.0`, and the deployed spelling `x-rpc-tool_verison: v4.5.0`.

DS1 uses epoch seconds `t`, six random ASCII letters `r`, and
`MD5("salt=<salt>&t=<t>&r=<r>")`, serialized as `t,r,digest`. These public
compatibility constants are not authentication secrets. UID prefix mapping is
`1/2 -> prod_gf_cn`, `5 -> prod_qd_cn`, `6 -> prod_official_usa`,
`7 -> prod_official_eur`, `8 -> prod_official_asia`, and
`9 -> prod_official_cht`.

Current deployed web bundles still emit DS headers. Authenticated success,
the smallest sufficient cookie set, and DS-omission tolerance were not live
verified because no user-authorized credential was used during development.
The UI and import receipt retain that limitation instead of claiming a tested
live login.

Global retcodes 10034 and 10035, and CN retcode 10035, are surfaced as an
interactive verification requirement. Retcode 10041 is treated as a hard
risk/forbidden state. GGStarRail does not automate Geetest solving; the user
must complete verification in HoYoLAB or 米游社 and retry.

Contract evidence:

- first-party Global page:
  <https://act.hoyolab.com/app/community-game-records-sea/rpg/index.html?bbs_presentation_style=fullscreen&bbs_auth_required=true#/hsr>
- first-party CN page:
  <https://webstatic.mihoyo.com/app/community-game-records/rpg/index.html>
- maintained response models and error behavior:
  <https://github.com/seriaati/genshin.py/blob/20d9179ce415da20139185b4e976080f7dc35afd/genshin/models/starrail/chronicle/characters.py>
- current CN signing corroboration:
  <https://github.com/PaiGramTeam/SIMNet/blob/eae122be380a0660ed2ab5fe453d63aca641cf7f/simnet/utils/ds.py>

## Scanner files and manager instructions

The file importer accepts the native GGStarRail envelope,
`goodscanner.hsr.experimental` v1 and v2, and interoperable Reliquary,
HSR-Scanner, Kel, and Fribbels v4 JSON. Experimental v2 distinguishes the exact
source kinds `screenCapture`, `packetCapture`, and `sanitizedFixture`, carries
explicit per-section coverage, and requires reference provider
`gilore.ggstarrail-reference`. Its source revision is a public
implementation/version identifier, never an account, session, or device
identifier. Its account-identifier, raw-packet, and server-item-identifier
privacy flags must all be literal `false`. Character, Light Cone, and Relic
identities use public GIlore string keys plus their actual public numeric game
IDs. Stat records contain only canonical property key, bilingual display name,
and display-unit value; ratio values are percentage points. V1 remains accepted
with unknown coverage. Arbitrary Kel/HSR-Scanner scan-order `_uid` values are
not treated as stable instance identity, while Reliquary instance IDs are
source-aware and hashed before entering canonical state.

Cross-record validation rejects duplicate instance keys, orphan equipment
references, mismatched two-way Character/equipment references, and more than
one equipped Relic in the same HSR slot. Unknown lock or discard observations
remain `null`, never an inferred unlocked/unmarked state.

Triage can export `goodscanner.hsr.manager-instructions` v1. The reference
provider is also `gilore.ggstarrail-reference`. `requestId` and every
instruction `id` are 1 to 128 characters containing only safe ASCII
`[A-Za-z0-9._:-]`. Each instruction contains a full public visible-item
matcher (including nullable
`locationKey`), an always-present `before` object with nullable `lock` and
`discard`, and a `desired` object containing exactly one lock or discard-mark
change.

The `sha256:` idempotency key is computed from the exact no-whitespace UTF-8
serialization of the two-field object containing `referenceRevision` followed
by `instructions`, in the generator's deterministic field and instruction
order; `requestId` is excluded. The scanner rebinds each matcher to the current
reference and observation before device actions. Both prior lock and discard
values must be known, fresh, and equal to the observation; unknown prior state,
equipped pieces, and duplicate or ambiguous visible matchers remain
preview-only. The manager envelope sets
`accountIdentifiersIncluded`, `rawPacketDataIncluded`, and
`serverItemIdentifiersIncluded` to literal `false` and excludes local IDs.
GGStarRail never emits salvage, delete, equip, or unlock operations and never
claims that exporting the file mutated the game.

## Secret lifetime

Authentication material lives only in the form and an `EphemeralAuthMaterial`
instance for one request. It is cleared in `finally` and cannot be serialized.
It is never placed in localStorage, sessionStorage, IndexedDB, Zustand,
backups, URLs, logs, fixtures, error objects, or manager/scanner exports. The
Worker applies `no-store` response headers and returns only bounded error
codes, never request material or an upstream error body.
