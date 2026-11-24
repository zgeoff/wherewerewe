# What the skills take from the store

- **Status:** agreed

Three skills in `zgeoff/skills` read a session's state today from a handoff doc, chat history and the live state of branches and pull requests. [brief.md](brief.md) defines the brief's sections, and [commands.md](commands.md) defines `www log --op`. When the session has a wherewerewe store, each reads it first, because the store already holds the state in the shape the skills need, with each checkable claim checked. Each skill still works with no store. The skill changes are their own slice, a pull request in `zgeoff/skills`, after the hooks. A build agent reads this doc to build the skill changes in `zgeoff/skills` in slice 6 of [build-order.md](build-order.md).

## Contracts

A skill knows the session has a store when `www` exits 0. Exit 4 means no store for this agent session, and the skill goes on as it does today. When a skill runs `www` from the main agent's shell, the hook writes `read`, which is right, because the brief is then in context.

| Handoff section         | From the store                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Goal                    | the brief's `GOAL`                                                                              |
| Where it stands         | done: `www log --op done`, with each row's evidence; in progress and not started: the open tasks from `www show`, which the agent splits between the two lists, each with its note, and each owed note marked as owed |
| Decided                 | `www log --op decide`, with who decided from `who=` in each row                                 |
| Approvals               | `GRANT`, with the owner's words copied whole and the reading beside them, then `APPROVED ONCE`; the second list, what still needs the owner's approval, is what the reading says the owner kept back, and each wait on `owner` |
| Waiting                 | `WAITING`                                                                                       |
| Next                    | `NOW` and its note, or, when the brief hides the step, a new one the agent writes with `www now` first |
| Where things are        | `WHERE`                                                                                         |
| Do it this way          | `RULES`                                                                                         |
| Ruled out               | `www log --op ruled-out`                                                                        |

## The changes, one paragraph each

**handoff.** Before it writes the doc, the skill runs `www` and acts on the brief: it closes or updates each item under `CHANGED SINCE WRITTEN`, so the doc starts from true claims. It then fills each section from the table above, and still runs its own Check it step on every claim the store holds no check for. The grant goes into the doc whole, in the owner's words, so an agent on another machine reads the same permission. Write the wherewerewe session's name in Where things are, so the next agent can run `www attach <name>` on this machine. The doc stays a file: it reaches an agent on another machine or with no tool, which the store cannot.

**where-were-we.** In Catch yourself up, the skill runs `www` first, before the handoff doc and the chat history. The skill takes what it may do without asking from the brief's `GRANT`, turns the `OWNER SAYS` lines and each wait on `owner` into decisions in the reply, and takes what happened since the last write from `CHANGED SINCE WRITTEN`. The skill still opens each pull request the brief marks `unchecked`.

**pickup.** When the handoff doc holds a wherewerewe session name, the skill runs `www attach <name>` before step 3, then `www`. A claim with a check needs no check by hand, since the brief has just run it. When the store has no grant and the doc's Approvals section holds the owner's words, the agent records them with `www grant`, with the reading from the doc. The skill checks by hand only the claims the brief shows with `no check`, and the claims in the doc that the store does not hold.

**figure-it-out, later.** Its decision log has columns the journal lacks: phase, evidence and result. Moving the log onto `www decide` needs those three as `--phase`, `--evidence` and `--result`, and a converter for existing `decisions.tsv` files. That is a separate change, after this design is built.

## Constraints

- Each skill runs the text form of a read, never `--json`.
- Each skill runs `www` with no `--session` flag, so it reads only the session bound to the agent running it.
- No skill writes to the store except through `www` commands, so every write passes the tool's limits and refusals.
- No skill text names a session, a repo or a person from a real store, because any repo can install the skills.

## Builder decides

- The wording of each skill change, under the skill-writing and docs-writing rules of `zgeoff/skills`.
