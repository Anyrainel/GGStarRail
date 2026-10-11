# Player-facing update history

The home page's roaming Pac-Man opens the bilingual What's New dialog.
GGStarRail owns its history independently from GenshinTools.

Publish approved entries in `src/content/updatelog/en.md` and
`src/content/updatelog/zh-CN.md`. Before the first approved entry, the dialog
shows its localized empty state. Both files use the same structure:

```markdown
## roadmap

## YYYY-MM-DD

### features
- Player-facing addition

### fixes
- Player-facing fix
```

Keep roadmap first and dates newest first. Omit empty sections. The files must
have matching dates, sections, and bullet counts. All copy is plain text.

For updates, fetch origin and gather commits since the last log edit, including
remote changes. For the first entry, summarize the current product rather than
inventing historical release dates. Include observable features and meaningful
fixes; exclude infrastructure, refactors, and transient provider maintenance.
Propose English and natural Simplified Chinese copy for review before writing
the entry. Use the actual publication date; merge same-day additions. Do not
publish automatically after commits. Validate and commit approved changes;
push only when requested.
