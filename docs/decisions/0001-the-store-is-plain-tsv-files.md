# 0001: The store is plain TSV files

- Date: 2026-11-23
- Status: decided

## Decision

Each session's store is a folder of plain UTF-8 files: `key=value` lines for the session, and tab-separated rows with a header for items, the journal, owner notes and pull requests. The `session` file carries a `format` version, and the tool reads only formats it knows.

## Why

- The owner reads the state with `less`, and an agent with no tool reads it with `cut` or `column`.
- The hand-kept store the build session already writes uses the same shape, so the first build can take it over.
- A cap on rows keeps each file the brief reads small, so a whole-file rewrite on each write costs nothing.

## Rejected alternatives

| Option            | Why not                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| SQLite            | the owner needs a client to read it, and an agent with no tool cannot read it at all           |
| one JSON file     | one bad write loses the whole state, and a person cannot read a long JSON line with `less`     |
| Markdown          | the format the tool replaces; nothing stops an append, and a parser for it is fragile          |

## Consequences

- No cell can hold a tab or a newline, so every write refuses them.
- A change to a column is a new format version, with a converter run by `www import`.
