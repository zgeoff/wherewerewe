# package

Check that the release binary installs and runs under both names. A user builds the binary for this
machine, installs it with `install.sh`, and runs `www help`, `wherewerewe help` and `www --version`.
The journey compiles the binary into a release folder inside the run's folder under `.wringer/`,
points `install.sh` at that folder through a `file://` URL and at the run's `bin` folder as its
install folder, and runs each name from there with its home and state folders inside the run. It
reaches no network, and writes nothing in your own `~/.local/bin`.

## Journey

Start a run first: steps 2 and 3 of [Check a change](../SKILL.md#check-a-change) run `up` and
`doctor`.

```bash
bun verify use --feature package
bun verify package build
bun verify package install
bun verify package run --name www --line 'help' --expect 'www (wherewerewe): what is true now in one long agent session, in one short brief.'
bun verify package run --name wherewerewe --line 'help' --expect 'www (wherewerewe): what is true now in one long agent session, in one short brief.'
bun verify package run --name www --line=--version --expect 'wherewerewe {version}'
```

## End state

- `package build` exits 0 and `data.target` is this machine's target, such as `linux-x64`. It fails
  with `usage` on a machine that has no binary, and with `check-failed` when the compile fails.
- `package install` exits 0, and its `data.stdout` is exactly three lines: the download of this
  machine's asset from the run's `release` folder,
  `installed wherewerewe <version> to <run>/bin/wherewerewe`, and the line that tells you to add the
  run's `bin` folder to `PATH`. It fails with `check-failed` when `install.sh` exits other than 0,
  such as on a checksum that does not match, or prints anything else on stdout or stderr.
- Each `package run` exits 0, and the first line of its `data.stdout` is exactly the `--expect`
  text, so `www` and `wherewerewe` both print the help's first line, and `www --version` prints
  `wherewerewe ` and the package's version, which `{version}` stands for. A match on a later line,
  text after the expected line, no output, or any output on stderr fails with `check-failed`.
- The binary runs with no Bun on its `PATH`, which is the run's `bin` folder alone. A `--line` that
  starts with a dash needs the `=`, as in `--line=--version`.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
