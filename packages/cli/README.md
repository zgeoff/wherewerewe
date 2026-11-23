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
them back as one brief. It also installs the same command as `wherewerewe`. No check runs yet, so
the brief shows what the agent wrote, with its age.

## Install

The CLI runs under [Bun](https://bun.sh).

```sh
bun add -g @wherewerewe/cli
www --help
```

## Features

- `www` prints the brief.
- `www help` and `www sessions` print the commands and the sessions on this machine.
- `www init`, `attach` and `detach` start a session and bind an agent session to it.
- `www goal`, `now`, `task`, `wait`, `rule`, `where` and `set` write a note.
- `www done` and `drop` close an item and keep it in the journal.

## Documentation

The [docs index](../../docs/README.md) lists the architecture docs.
