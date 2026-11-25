The `@wherewerewe/cli` package holds the source of `www` and `wherewerewe`, the commands that keep
the notes of one long agent session. The package is private. Each release compiles it to one binary
per platform, which the Homebrew tap and `install.sh` install. To see how its parts fit, read
[the overview](../../docs/architecture/overview.md). `www install` and `www doctor` set up and check
the hooks that hold an agent's other tool calls until it reads its brief after a compaction.
