# 0025: One table of labelled rows

- Date: 2026-11-26
- Status: decided

## Decision

Version 0.2.0 rebuilds the tool around one kind of thing: a row with an id, a label, a text of at most 300 characters and an optional note. Each session keeps its rows in one append-only JSON Lines file. A label is data, and only six labels get a shape check on the way in. Bare `www` prints the brief as text, and every other command prints JSON, with `--human` for plain text. The gate keeps two hooks per host. This replaces records 0001 to 0024, which described version 0.1.0. The [design](../design/wherewerewe/README.md) holds what still stands from them: binding by the host's session id, the gate that fails open, one install per machine, the shipped skill, and compiled binaries through the Homebrew tap and an install script.

## Why

- Version 0.1.0 had ten kinds of note, and each kind had its own file, command, limits and JSON shape. The kinds held the same data: a line of text with a label. The source was 21,825 lines for 24 commands.
- Four sessions used 0.1.0 for days, and each used it differently. Of 68 open rows across them, 3 used a check. The agents wrote the facts they needed as text, whatever the kind.
- A write was refused for a text over 120 characters, for a seventh task and for other caps. Each refusal cost the agent a retry, and the caps taught agents to write less.
- An agent reads JSON with `jq` and `grep` well. The tool needs no list, search, history or recap command when it prints its rows as JSON lines.
- With one append-only file, two writers cannot damage each other, so the lock and its stale-lock rules are gone.

## Rejected alternatives

| Option                                           | Why not                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| trim 0.1.0 in place                              | each kind's code was built apart, so removing kinds one by one costs more than a rewrite |
| no limit on a text                               | a notes file with no limit becomes a wall of text that nobody reads back              |
| keep the checks of pull requests, paths and pids | 3 of 68 rows used one, and an agent runs `gh` and `git` itself                        |
| a `blocked-by` field                             | the tool is not a task system, and an agent can write "blocked by wait-2" in the text |
| a grant that must start with may, not or never   | the owner grants in plain words, and the tool keeps them as said                      |

## Consequences

- The source is about a tenth of its 0.1.0 size.
- The first read of a 0.1.0 store writes `rows.jsonl` beside the old files, which stay as the backup. The converted rows keep their ids.
- `www install` removes the hook entries of 0.1.0 and writes two per host. Codex asks its user to trust the new entries once.
- The commands `list`, `show`, `log`, `recap`, `say`, `ack`, `ok`, `use` and `import` are gone, and so are checks, owner notes and the caps on how many rows a label holds.
- A new feature needs a real failure in use first.
