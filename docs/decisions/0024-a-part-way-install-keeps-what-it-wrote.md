# 0024: A part-way install keeps what it wrote

- Date: 2026-11-25
- Status: decided

## Decision

When a settings file changes between its read and its rename a second time, `www install` refuses with exit 3. Each file it wrote before that file stays written, and the reply names it. A rerun of `www install` finishes the install.

## Why

- Two renames cannot be one step, so an install that writes the Claude Code file and then the Codex files cannot make both appear at once.
- A rollback from the backup would overwrite an edit that another program made after the install wrote the file.
- `www install` is idempotent, so a rerun adds only what is still missing.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| restore each written file from its `.www-backup` | it overwrites the concurrent edit that caused the refusal |
| a lock around every settings file | neither host takes it, so it guards nothing |

## Consequences

- A refused install can leave the Claude Code file holding the entries while the Codex files do not. The reply says which, and its `Run:` line has no `# nothing was written` comment.
- `www doctor` reports the files still missing an entry until the rerun.
