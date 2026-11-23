# Documentation

## Architecture

- [Overview](./architecture/overview.md): the package, its two commands, and what works.

## Design

- [wherewerewe](./design/wherewerewe/README.md): the design of the notes store, its commands, the
  brief and the hooks, before it is built.

## Decisions

- [0001: the store is plain TSV files](./decisions/0001-the-store-is-plain-tsv-files.md)
- [0002: sessions bind by agent session ID](./decisions/0002-sessions-bind-by-agent-session-id.md)
- [0003: checks are built-in read-only probes](./decisions/0003-checks-are-built-in-read-only-probes.md)
- [0004: hooks install once per machine](./decisions/0004-hooks-install-once-per-machine.md)
- [0005: owner notes need a terminal outside any agent](./decisions/0005-owner-notes-need-a-terminal-outside-any-agent.md)
- [0006: ship TypeScript source run by Bun](./decisions/0006-ship-typescript-source-run-by-bun.md)
- [0007: hooks do not build on agent-hooks](./decisions/0007-hooks-do-not-build-on-agent-hooks.md)
