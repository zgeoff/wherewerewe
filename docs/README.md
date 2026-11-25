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
- [0006: ship TypeScript source run by Bun](./decisions/0006-ship-typescript-source-run-by-bun.md),
  replaced by
  [0022](./decisions/0022-ship-compiled-binaries-through-the-tap-and-an-install-script.md)
- [0007: hooks do not build on agent-hooks](./decisions/0007-hooks-do-not-build-on-agent-hooks.md)
- [0008: notes, the grant, and no caution steering](./decisions/0008-notes-the-grant-and-no-caution-steering.md)
- [0009: 30 open tasks and a count of the rest](./decisions/0009-30-open-tasks-and-a-count-of-the-rest.md)
- [0010: the brief's budget follows its host](./decisions/0010-the-brief-budget-follows-its-host.md),
  replaced by [0016](./decisions/0016-the-brief-limit-is-20000-tokens-or-the-host-limit.md)
- [0011: a grant of limits and its lines](./decisions/0011-a-grant-of-limits-and-its-lines.md)
- [0012: a capped heading names its max](./decisions/0012-a-capped-heading-names-its-max.md)
- [0013: the hooks gate until the agent reads the brief](./decisions/0013-the-hooks-gate-until-the-agent-reads-the-brief.md)
- [0014: the gate fails open](./decisions/0014-the-gate-fails-open.md)
- [0015: a post-tool hook marks the brief read](./decisions/0015-a-post-tool-hook-marks-the-brief-read.md)
- [0016: the brief's limit is 20,000 tokens or the host's limit](./decisions/0016-the-brief-limit-is-20000-tokens-or-the-host-limit.md)
- [0017: a lesson is a kind of its own](./decisions/0017-a-lesson-is-a-kind-of-its-own.md)
- [0018: a promise is a kind of its own](./decisions/0018-a-promise-is-a-kind-of-its-own.md)
- [0019: the owner's words are a kind of their own](./decisions/0019-the-owners-words-are-a-kind-of-their-own.md)
- [0020: authority comes from the owner's own acts](./decisions/0020-authority-comes-from-the-owners-own-acts.md)
- [0021: a refused write says so on its Run line](./decisions/0021-a-refused-write-says-so-on-its-run-line.md)
- [0022: ship compiled binaries through the tap and an install script](./decisions/0022-ship-compiled-binaries-through-the-tap-and-an-install-script.md)
- [0023: the CLI ships its own www skill](./decisions/0023-the-cli-ships-its-own-www-skill.md)
