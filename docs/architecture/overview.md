# Overview

`wherewerewe` will keep the notes of one long coding agent session, and print them back as one short
brief after each compaction. No part of that is built yet. The repo holds the package, its checks
and its release setup, and the one command that works prints the help.

## The package

The `@wherewerewe/cli` package in `packages/cli/` installs two commands, `www` and `wherewerewe`,
that run the same file. Agents and people type `www`, because it is short. A script or a hook calls
`wherewerewe`, because no other common tool uses that name.

The package ships its TypeScript source, and Bun runs it, so the repo has no build step.
`src/cli.ts` prints the help for `help` and `--help`, and exits 1 with the help on stderr for any
other command.
