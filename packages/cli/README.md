<div align="center">
  <h1>@wherewerewe/cli</h1>

  <p>
    <a href="https://www.npmjs.com/package/@wherewerewe/cli"><img src="https://img.shields.io/npm/v/@wherewerewe/cli" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  </p>

  <p>
    <a href="../../docs/README.md">Documentation</a>
  </p>
</div>

Notes for one long agent session: what is true now, in a brief an agent can read after a compaction.

A coding agent that works in one session for days loses its context at each compaction. This package
installs `www`, the command that agent uses to keep short notes on what is true now, and to read
them back as one brief. It also installs the same command as `wherewerewe`. Each read checks the
pull requests, branches, paths and processes in your notes, and marks each claim that is no longer
true.

## Install

The CLI runs under [Bun](https://bun.sh).

```sh
bun add -g @wherewerewe/cli
www --help
```

## Features

- `www` prints the brief, with a live check of each pull request, branch, path and process an item
  names.
- `www help` (the same as `www --help`) prints the commands, and `www sessions` prints the sessions
  on this machine.
- `www init`, `attach` and `detach` start a session and bind an agent session to it.
- `www goal`, `now`, `task`, `wait`, `rule`, `where` and `set` write a claim.
- `--note` keeps a note of detail on an item. `--owed` blocks closing the item until
  `www set <id> --no-note` clears the note.
- `www ok` records the owner's one-time approval, and `use` spends it.
- `www grant` keeps the owner's words as bullets of what they allow, did not grant and ruled out,
  with where they gave them and your reading of them; the brief prints them after the goal. Give a
  grant at least one bullet, in any of the three groups.
- `www decide` records a decision, or an approach that was ruled out, and numbers it `d-<n>`.
- `www lesson`, `promise` and `words` keep a lesson with the mistake behind it, a promise to the
  owner with its due time, and the owner's exact words; `done` closes a promise, and `drop` closes
  any of the three.
- `www list <kind>` prints every open row of one kind, whole, as the brief prints it.
- `www done` and `drop` close an item and keep it in the journal.
- `www say` and `ack` let the owner write a note from a terminal outside any agent. The note stays
  in every brief until the owner clears it.
- `www import` converts a hand-kept store to format 2 in place, and keeps the originals in
  `import-backup/`. It upgrades a format 1 store the same way, and keeps the originals in
  `format-1-backup/`.
- `www show` prints one item or decision with its history, and with no id, every open task. `log`
  prints the journal.
- `www recap` prints one screen for the owner: the grant, the promises, the notes on open items, and
  the decisions and closes since a time.
- `--json` on `www`, `show`, `log`, `list` and `recap` prints one JSON value for a script, in place
  of the text.
- `www goal --paste` prints the grant as a `/goal` text for the owner to paste.
- `www install` and `www doctor` set up and check the hooks that hold an agent's other tool calls
  until it reads its brief after a compaction, with the allow rules and the `www` skill.

## Documentation

The [docs index](../../docs/README.md) lists the architecture docs.
