# Runtime game data

`src/data/game/` mirrors GenshinTools' per-entity numeric, English, Chinese and
beta file boundaries. GIlore produces these files; the application does not
import its raw bilingual reference members.

`gameDataLoader.ts` loads a member only when a consumer requests it. Numeric and
locale files are independent Vite URL assets with content hashes. Both locale
files currently load because archive searches intentionally match English and
Chinese names and descriptions regardless of the selected display language.
The DTO presented to existing consumers retains its stable IDs and bilingual
shape. Changing this transport does not change account storage or backup IDs.

Source-revision placeholders are hydrated from the transport manifest. This
keeps a revision-only update from changing otherwise identical data files.
Concurrent requests share a promise; failed requests are evicted so a later
attempt can recover. Missing locale pointers are export corruption, not an
empty-content condition.

## Unreleased content

The default is off, including development. Enter `开启测试模式` in an archive
search field to opt in; the preference is saved under
`ggstarrail:enable-beta:v1` and the page reloads to rebuild all catalog caches.
Enter `关闭测试模式`, or use the visible disable button in beta mode, to return
to released content. The GenshinTools preference is independent.

The loader never fetches beta assets while the preference is off. Once enabled,
it decompresses the corresponding `*_beta_*.json.gz` files and adds beta-only
IDs. Released records win in a collision. Character enhancements have a narrow
exception: an empty released enhancement array can receive the separately
preserved beta enhancement array. No other released character fields are
replaced by that overlay.

HoYoWiki release evidence controls the released partition. A record's presence
in a datamine does not establish that it is released. GIlore's raw diagnostics
are kept out of the runtime so their unreleased identifiers and text cannot
bypass this boundary.

Nanoka-only entities that lack fields required by the complete reference model
use `nanoka_*` preview members. These appear in the beta archive with the
available source text, numbers and images. They do not enter account/build
catalogs until a complete normalized definition exists. Missing mechanics are
not replaced with synthetic zeroes or inferred defaults.

## Validation

`tests/data/` covers opt-in persistence, network gating, gzip reconstruction,
retry behavior, released-wins merging and partial preview rendering. The full
catalog compatibility tests exercise the complete opt-in normalized snapshot;
release partition checks exercise default visibility separately. Test HTTP
requests for game assets read the actual published files, while unexpected
network requests remain blocked.


## GOODCapture game data

`/good/hsr_data_cache.json` is a stable public endpoint for the Windows companion.
It contains the full normalized public catalog and packet affix/form mappings from
one GIlore revision. It carries no account data. GOODCapture checks it every two
hours and exposes Refresh game data for an immediate update; an offline client
can continue using its last validated local cache.

The default GIlore command, `uv run python -m hsr_data reference`, writes both
`src/data/game/` and `public/good/hsr_data_cache.json` in the sibling GGStarRail
checkout, using cached source evidence. Add `--pull` to refresh the datamine, or
`--no-website` for a GIlore-only build. `npm run data:update` additionally refreshes
HoYoWiki/Nanoka evidence before calling the same website export function. `data:website:check` rejects revision or catalog coverage drift.
Publish the generated JSON with normal website changes; data updates require no
new executable. `_headers` requires revalidation instead of immutable caching.
