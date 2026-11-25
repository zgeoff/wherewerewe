# Install wherewerewe

wherewerewe ships as one compiled binary, `wherewerewe`. Homebrew links `www` to it, and the install
script makes the same link unless another tool's `www` is already in its folder. Each release has a
binary for macOS and Linux on arm64 and x64, and the machine needs no runtime. On Linux the binary
needs glibc, so it does not run on Alpine or another musl-only system. Install it with Homebrew or
with the install script, then run `wherewerewe install` once to add the hooks. Both ways install the
same binary.

## Install with Homebrew

```sh
brew install zgeoff/tap/wherewerewe
```

Homebrew links `wherewerewe` and `www` into its `bin` folder, such as `/opt/homebrew/bin` on macOS
with Apple silicon.

## Install with the script

```sh
curl -fsSL https://raw.githubusercontent.com/zgeoff/wherewerewe/main/install.sh | sh
```

The script downloads the binary of the latest release for this machine into `~/.local/bin`. To use
another folder, set `WHEREWEREWE_INSTALL_DIR` before you run it. When the folder is not on your
`PATH`, the script says so, and edits no shell profile.

The script moves the binary into place only when its hash matches its line in the release's
`SHA256SUMS` and the downloaded binary runs `--version`. On any problem with the download, the
checksums, the machine's hash tool or the binary, it prints one line, exits 1, and leaves the folder
and any earlier install as they were. It also stops when a folder stands where `wherewerewe` goes.

The script makes `www` a link to `wherewerewe` when `www` is missing or already that link. It leaves
any other `www`, such as another tool's, and says so.

## Set up the hooks

Run `wherewerewe install` once per machine, and again after each upgrade. It adds the hooks, the
allow rules and the `www` skill to Claude Code and Codex. In Codex, trust each new hook entry once,
in its `/hooks` screen. Run `wherewerewe doctor --human` to check the result. See
[Install and doctor](../design/wherewerewe/README.md#install-and-doctor) for what
`wherewerewe install` writes.

Codex runs each command in a sandbox that cannot write outside the workspace. Add the store to its
writable roots in `~/.codex/config.toml`, or a `www` write from Codex fails:

```toml
[sandbox_workspace_write]
writable_roots = ["/home/<you>/.local/state/wherewerewe"]
```

## Check which www comes first

`wherewerewe` always runs this tool. Before you type `www`, check that it is this tool too, because
another tool's `www` can come first on your `PATH`. Run this command, which only looks the name up
and lists the file it finds:

```sh
ls -l "$(command -v www)"
```

`www` is this tool when the listing ends in `-> wherewerewe`, the script's link, or in a path under
`Cellar/wherewerewe/`, Homebrew's link. Otherwise, type `wherewerewe` in place of `www` in every
command.

## Upgrade

- With Homebrew, run `brew upgrade wherewerewe`.
- With the script, run it again, with the same `WHEREWEREWE_INSTALL_DIR` if you set one. It replaces
  the binary in place, so the path in the hook entries stays the same, and Codex asks for no new
  trust.

After an upgrade from 0.1, the first `www` in each session converts its store. It writes
`rows.jsonl` beside the old files and leaves them as the backup.

## Remove

1. Run `brew uninstall wherewerewe`, or remove `wherewerewe` from the install folder, and remove
   `www` there too when it is a link to `wherewerewe`.
2. Remove what `wherewerewe install` wrote, following
   [Install and doctor](../design/wherewerewe/README.md#install-and-doctor).

Your sessions stay in `~/.local/state/wherewerewe/`, because `www` never deletes a store.
