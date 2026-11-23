# Agent Guidelines

This repo holds `wherewerewe`, a command-line tool that one coding agent uses to keep its notes through a long session. Hand back a pull request into `main` with green CI. Never merge it: the owner reviews it and squash-merges it.

## Required reading

Load the skill for your task before you start it. Repo-sync copies each skill into `.agents/skills/`, and overwrites any edit made there, so never edit a synced skill in this repo. Put each rule of this repo's own in a `project-<name>` skill in `.agents/skills/`. Before you write a design or a decision record, load `design-docs` from `zgeoff/skills`, which repo-sync does not copy.

| Task                                               | Skill          |
| -------------------------------------------------- | -------------- |
| Write or review TypeScript                         | `code-style`   |
| Write or review a test                             | `testing`      |
| Write or edit a doc, a README or this file         | `docs-writing` |
| Add or change a workflow, a job or a release gate  | `ci-design`    |

## Repo structure

```text
packages/cli/       the @wherewerewe/cli package, which installs the www and wherewerewe commands
  src/              the CLI source, which Bun runs as TypeScript, with each test beside its module
docs/               the docs index, the architecture docs, the design and the decision records
  architecture/     how the built system works, starting at overview.md
.agents/skills/     the skills repo-sync copies in, and this repo's own project skills
```

## Checks

Run these from the repo root before you push. CI runs the same checks on each pull request.

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run deadcode
bun run check:docs
```

The pre-push hook runs the chex baseline, which checks what the branch changes.

## Commits and pull requests

Write each commit message and each pull request title as a Conventional Commit in the imperative mood, such as "add the brief command", never "added the brief command". The commit-msg hook runs commitlint on each commit. The owner squash-merges each pull request, so its title becomes the commit subject on `main`. Never add attribution lines.
