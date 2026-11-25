# 0022: Ship compiled binaries through the Homebrew tap and an install script

- Date: 2026-11-25
- Status: decided

## Decision

wherewerewe ships as one compiled binary per platform, for macOS and Linux on arm64 and x64, built with `bun build --compile` and attached to each GitHub release with a `SHA256SUMS` file. The formula `wherewerewe` in the owner's Homebrew tap and the repo's `install.sh` each install the binary as `wherewerewe`, with `www` as a link to it. Nothing is published to npm, and the package is private. A hook entry runs `<bin> hook claude` or `<bin> hook codex`, where `<bin>` is the path that `command -v wherewerewe` printed when `www install` ran, kept as printed and never resolved. This replaces [0006](0006-ship-typescript-source-run-by-bun.md).

## Why

- The owner chose the tap and an install script, the channel of his other tools, over npm.
- The binary needs no runtime on the machine, so an agent with no Bun runs it, and a hook whose `PATH` lacks Bun runs it.
- A hook entry names one path. Homebrew's link in its `bin` folder and the script's replace in place keep that path across upgrades, so the entry text never changes, and Codex never asks for trust again.
- A compiled `www help` started in 8 to 10 ms on linux-x64, against 26 to 30 ms for the source run by Bun.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| TypeScript source on npm, run by Bun ([0006](0006-ship-typescript-source-run-by-bun.md)) | needs Bun on the machine, and a hook entry that names two paths |
| the resolved path of the binary in each hook entry | the Homebrew path changes on every upgrade, and a changed Codex entry waits for trust |
| `www` and `wherewerewe` as two copies of the binary | two files of about 94 MB each |

## Consequences

- Each release builds four binaries of about 94 MB each.
- `www install` refuses when no `wherewerewe` is on `PATH`, and `www doctor` reports an entry whose path is gone or no longer the first `wherewerewe` on `PATH`.
- A build agent installs a copy by compiling the binary and copying it out of the worktree.
- The exit 5 line for a store newer than the tool names the command that upgrades the binary where it was installed.
