# GGArtifact icons

The approved icon pair is stored as self-contained vectors in `public/`:

- `logo-gi.svg`: GGArtifact [Genshin], for the app switcher.
- `logo-hsr.svg`: GGArtifact [Star Rail], for app bars and switchers.
- `favicon.svg`: simplified Star Rail artwork for browser tabs.
- `favicon-48.png`: 48 px PNG fallback.
- `apple-touch-icon.png`: 180 px icon.

Both sites keep identical local copies of the two full logos. This approved
brand sharing does not introduce a runtime dependency on the Genshin site.
The favicon SVG is intentionally simpler than the full-size logo. The vectors
are the editable source assets; PNG derivatives can be regenerated with Sharp
at their named sizes. Vite's explicit public asset list includes all five files.

The icons were approved on September 7, 2026. The Star Rail mark is an original
vector adaptation inspired by the currency reference, with an ivory/peach
body, blue base, and upper-left lighting. Keep the approved geometry and color
assignments when producing other sizes. The decorative home-page wordmark is
separate artwork from the app and favicon mark.
