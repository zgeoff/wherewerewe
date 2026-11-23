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
  verify/       the verify CLI and its registry, run as bun verify
.agents/skills/ the skills repo-sync copies in
.github/        the pull request template and the workflows
```

## Packages

- Every external version lives once, in the root `workspaces.catalog`. A package writes `"catalog:"` for an external dependency and `"workspace:*"` for an internal one.
- Pin exact versions, with no `^` or `~` ranges. `bun add` saves exact versions; apply the same rule to hand-written edits.

## Commands

- Before you push, run `bun run typecheck`, `bun run lint`, `bun run test` and `bun run check:docs`, and fix every failure.
- `bun run format` fixes formatting.
- lefthook fixes the staged files before a commit, and runs the chex baseline before a push.
- Leave `bun run lint:full`, the type-aware lint, to CI. It can run out of memory on a small host.

## Verify before you hand off

`bun verify` runs the real `www` and drives each feature, such as `help`, through its journey: the `bun verify` lines that stand for what a user types. When a feature's journey reaches its end state, `bun verify done` records a verdict for it. The `verify / gate` check fails a pull request that changes a feature with no verdict in its description.

After your last code change:

1. Load the `verify` skill, and follow its "Check a change" steps for each feature that `bun verify report` marks `changed: true`.
2. Push the branch and open the pull request, then run `bun verify publish`. It writes the report into the pull request's description, and fails when none is open.

An edit to a feature's files after `done` makes its verdict stale: run its journey and `done` again, then publish again. After you edit the `verify` skill, a feature file or the registry, run `bun verify lint`. When `lint` fails with check `template`, as after a `@wringer/gunshi` bump, follow `bun verify guide maintain`.

## Commits and pull requests

- Every change reaches `main` through a pull request from its own branch. Open it with the repo's pull request template.
- Write each commit message and PR title as a Conventional Commit in the imperative mood: "add X", never "added X". A squash merge makes the PR title the commit subject.
- Add no attribution lines: no co-author trailers and no generator notes.
