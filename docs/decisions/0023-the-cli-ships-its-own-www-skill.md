# 0023: The CLI ships its own www skill

- Date: 2026-11-25
- Status: decided

## Decision

The binary carries the text of the `www` skill, and `www install` writes it to Claude Code's personal skills folder, `~/.claude/skills/www/SKILL.md` (under `$CLAUDE_CONFIG_DIR` when that is set), and to Codex's user skills folder, `~/.agents/skills/www/SKILL.md`. The file's frontmatter holds the version that wrote it and a hash of its body. `www install` replaces a skill it wrote and nobody edited, of any version, and never replaces any other file without `--replace-skill`, which moves that file to `SKILL.md.replaced` first.

## Why

- The skill matches the commands and flags of the installed version, because both come from one binary.
- The owner's own skills still change through a pull request that he reviews, a different path from this one.
- Neither host asks for trust when a skill changes. A new version's skill needs no step from the owner, unlike a hook entry, which Codex skips until the owner trusts it again.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| the skill only in the owner's skills repo | it drifts from the installed version, so it names a command the binary no longer takes |
| a skill written once and never updated | the same drift, from the first release |

## Consequences

- An upgrade changes the skill on the next `www install`.
- `www doctor` reports a skill that differs from this binary's.
- `www install` refuses a skill file that has no mark or an edited body, writes nothing anywhere, and names `--replace-skill` as the fix.
