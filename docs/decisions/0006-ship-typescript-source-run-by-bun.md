# 0006: Ship TypeScript source run by Bun

- Date: 2026-11-23
- Status: proposed

## Decision

`@wherewerewe/cli` ships its TypeScript source, with `#!/usr/bin/env bun` on the command file and no build step. Each hook entry calls Bun by its absolute path, so a hook runs even when its `PATH` lacks Bun.

## Why

- It is the default the repo-standard skill sets for a CLI that does not have to run under Node, and nothing here does.
- A small TypeScript command run by Bun starts in a few milliseconds, well inside the 150 ms a hook may take.
- No build means no bundle to keep in step with the source, and no build step in each release.

## Rejected alternatives

| Option                                    | Why not                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| a bundle built for Node                   | adds a build to serve machines with Node and no Bun, where an agent can install Bun with one command |
| a compiled binary (`bun build --compile`) | about 90 MB per platform, and a release per operating system and architecture                 |

## Consequences

- An agent with no Bun installs it before it can run the tool, or reads the store's text files.
- `www install` records Bun's absolute path; when Bun moves, `www doctor` says so and `www install` fixes it.
