# 0003: Checks are built-in read-only probes

- Date: 2026-11-23
- Status: decided

## Decision

An item's check is one of four built-in probes: a pull request, a branch, a path or a process. Each probe runs a fixed read-only command with the reference's parts as arguments, never through a shell. A check marks a claim as changed and prints the command that fixes it; it never changes an item.

## Why

- Every read runs every check. A stored shell command would run, unread, on each read, after anyone or anything had edited the store.
- A fixed probe has a fixed set of results, so the brief can say exactly what changed and which command fixes it.
- An agent that closes its own item with evidence keeps the habit of writing; a tool that closes items for it does not.

## Rejected alternatives

| Option                                      | Why not                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| a free shell command per item               | runs arbitrary code on every read, and its output has no fixed meaning                      |
| closing an item when its pull request merges | a merged pull request does not prove the claim, such as "deployed to staging", is done     |
| no checks, with each line's age shown       | an age cannot tell a stale line from a true one                                             |

## Consequences

- A claim about anything the four probes cannot see shows its age instead.
- Each new kind of probe is a code change and a new set of results.
