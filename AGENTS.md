# Agent Guidelines

This repo is wherewerewe, a command-line tool that one coding agent uses to keep its notes through a long session. Read [the overview](docs/architecture/overview.md) to see how its parts fit. Hand back a pull request into `main` with green CI, and never merge it: the repo owner merges every pull request.

## Required reading

The rules a task needs are not repeated here. Load the skill for the work before starting it. The skills are in `.agents/skills/`, and `.claude/skills` links to that folder.

| Skill           | Load before                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `code-style`    | writing, reviewing, or renaming any TypeScript                              |
| `testing`       | designing, writing, or reviewing tests                                      |
| `docs-writing`  | writing or editing any committed prose: `docs/`, READMEs, this file, skills |
| `ci-design`     | adding, changing, or reviewing a workflow, a job or a step                  |
| `skill-writing` | writing or editing a skill                                                  |
| `cold-read`     | checking a skill you wrote or changed, before its PR                        |
| `deslop`        | editing the prose of a skill you wrote or changed, before its PR            |

repo-sync delivers each shared skill at the `zgeoff/skills` commit that `zgeoff/tools` pins, and overwrites a local edit. Never edit a shared skill here. Put a rule of this repo's own about code, tests, docs or CI in a `project-<name>` skill beside the shared skill on that topic. repo-sync copies no `design-docs` skill: before you write a design or a decision record, load [`design-docs`](https://github.com/zgeoff/skills/tree/main/skills/design-docs) from zgeoff/skills.

When you write or edit a skill:

1. Load the `skill-writing`, `cold-read` and `deslop` skills from `.agents/skills/`.
2. Do every step in the "Check it" section of `.agents/skills/skill-writing/SKILL.md`. In its last step, tick the Deslop and Cold read lines of the PR template's `## Checks` section, each with the short hash of the commit you checked, and leave the chex line for CI.

## Repo structure

wherewerewe is one Bun workspace.

```text
packages/       the workspace packages
  cli/          the @wherewerewe/cli package, which installs the www and wherewerewe commands
docs/           the docs index, the architecture docs, the design and the decision records
  architecture/ how the built system works, starting at overview.md
scripts/        the repo's CI step scripts and the dead-code check
.agents/skills/ the skills repo-sync copies in
.github/        the pull request template and the workflows
```

## Packages

- Every external version lives once, in the root `workspaces.catalog`. A package writes `"catalog:"` for an external dependency and `"workspace:*"` for an internal one.
- Pin exact versions, with no `^` or `~` ranges. `bun add` saves exact versions; apply the same rule to hand-written edits.

## Commands

- `bun run typecheck`, `bun run lint` and `bun run test` are the local checks. Run them before you push, and fix every failure.
- `bun run format` fixes formatting, and `bun run check:docs` runs the docs checks.
- lefthook runs the light checks before a commit and a push. Leave the larger checks to CI, because the host may have little memory.

## Commits and pull requests

- Every change reaches `main` through a pull request from its own branch. Open it with the repo's pull request template.
- Write each commit message and PR title as a Conventional Commit in the imperative mood: "add X", never "added X". A squash merge makes the PR title the commit subject.
- Add no attribution lines: no co-author trailers and no generator notes.
