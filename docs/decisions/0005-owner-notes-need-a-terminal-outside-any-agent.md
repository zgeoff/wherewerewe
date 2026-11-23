# 0005: Owner notes need a terminal outside any agent

- Date: 2026-11-23
- Status: proposed

## Decision

`www say` and `www ack` run only when stdin and stdout are terminals and no agent session variable is set. Owner notes live in their own file, which no agent command writes. Nothing signs a note.

## Why

- The check stops an agent that writes an owner note from its shell tool by mistake, which is the case that happens.
- The agent runs as the same Unix user as the owner and can read every file the owner can, so no key on the machine is out of its reach.
- A separate file means a bug in an agent write cannot drop an owner note.

## Rejected alternatives

| Option                                | Why not                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| notes signed with an owner key        | the agent can read the key, so a signature proves nothing, and the owner must manage a key  |
| a hash chain over the journal         | detects an edit only when someone verifies it, and adds repair work after a crash           |
| owner notes in items.tsv              | every agent write rewrites that file, so one bug could drop or edit a note                  |

## Consequences

- An agent that fakes a terminal and clears its variables can still write an owner note. The owner reads `www log --op say,ack` to catch it.
- The owner writes notes from a terminal outside the agent, not with `!` inside Claude Code.
