# Runtime game data

`src/data/game/` mirrors GenshinTools' per-entity numeric, English, Chinese and
beta file boundaries. The data producer generates these files; the application does not
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
in a datamine does not establish that it is released. The producer's raw diagnostics
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

`/good/hsr_scanner_data.json` (formatVersion 2) is the shared inventory endpoint
for the Windows companion's OCR scanner, packet capture and manager. It contains
the normalized public inventory catalog and packet affix/form mappings from one
source revision, with no achievement data or account data. Clients check it every
two hours and expose Refresh data for an immediate update; offline clients can
continue using their last validated local cache or bundled reference.

`/good/hsr_achievement_ids.json` carries the public achievement ID set and source
revision. Only achievement capture downloads it, and its revision must match the
inventory reference. The full OCR mapping remains independently published as
`/good/mapping_achievements.json`. Inventory scanning and manager operations do
not download either achievement file. The old combined endpoint is removed;
website and companion releases must be published together.

The data producer writes `src/data/game/`, `public/good/hsr_scanner_data.json`
and `public/good/hsr_achievement_ids.json`
into its selected website checkout and retains identical local exports. The website
does not locate or invoke the producer. `data:website:check` rejects revision or
catalog coverage drift.
Publish the generated JSON with normal website changes; data updates require no
new executable. `_headers` requires revalidation instead of immutable caching.
