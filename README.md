<div align="center">
  <h1>wherewerewe</h1>

  <p>
    <a href="https://www.npmjs.com/package/@wherewerewe/cli"><img src="https://img.shields.io/npm/v/@wherewerewe/cli" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a>
  </p>
</div>

Notes for one long agent session: what is true now, in a brief an agent can read after a compaction.

A coding agent that works in one session for days loses its context at each compaction.
`wherewerewe`, typed as `www`, is the command that agent will use to keep short notes on what is
true now, and to read them back as one brief. The CLI prints its help and does nothing else yet.

## Install

The CLI runs under [Bun](https://bun.sh).

```sh
bun add -g @wherewerewe/cli
www --help
```

## Features

- `www help` prints the commands.

## Documentation

The [docs index](./docs/README.md) lists the architecture docs.
