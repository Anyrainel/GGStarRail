# Scanner achievement mappings

`/good/mapping_achievements.json` contains released HSR achievements nested under
their categories, with numeric IDs and Chinese names:

```json
{"categories":[{"id":1,"n":{"zh":"我，开拓者"},"achievements":[{"id":4010101,"n":{"zh":"炽燃不灭的琥珀"}}]}]}
```

Categories and their achievements are sorted by numeric ID. Names are not unique;
preserve every ID when matching titles. The `n.zh` field follows the scanner mapping
contract. Only achievements admitted by the website's release evidence are included.

Regenerate and sync from HoyoData:

```sh
uv run python -m hsr_data reference
```

This writes the mapping here and mirrors it into HoyoData's versioned website
archive alongside `hsr_data_cache.json`.
