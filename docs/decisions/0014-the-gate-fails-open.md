# 0014: The gate fails open

- Date: 2026-11-25
- Status: decided

## Decision

The gate never stops an agent for long. It changes state only on hook events, and no rule reads a clock. When a hook cannot start, fails or times out, the host runs the call, and `www install` never sets `onFailure: "block"`. While a brief command the gate let through runs, every other call is refused. When it ends with no whole read, the next call passes with one line. When a Codex read reaches the model cut, the gate refuses once with the cut reason and lets the agent read again; after that cut it refuses at most one call in all, however many retries are cut, and a failed retry opens it on the next call. When the host sends no end event for the brief command, the end of the turn counts as a failed end. Each hook applies its event under an exclusive lock on the gate file, so two hooks that run at once never lose a write. `Stop` blocks at most once per turn.

## Why

- The owner's failure case is an agent that is stopped or looping, as [0008](0008-notes-the-grant-and-no-caution-steering.md) records. A separate permission check polices what the agent does.
- A failed `www` fires `PostToolUseFailure` in Claude Code, not `PostToolUse`, so a hook on that event sees every failed read. In a run where `www` exited 5, the next call opened the gate.
- A brief over Claude Code's shell output limit reaches the model as a preview, and `PostToolUse` sees no footer line. The same path opens the gate.
- When Claude Code's permission step refused `www` in a headless run, none of `PostToolUse`, `PostToolUseFailure` and `PermissionDenied` fired. `Stop` is the next event that proves no call runs.
- A rule that reads the time cannot keep both promises. A threshold short enough to open the gate soon lets a call pass while a slow `www` still runs, and a review found an order of calls that broke each timed rule tried.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| fail closed with `onFailure: "block"` | a broken hook stops every tool call in every bound session |
| refuse until `www` exits 0 | an exit 5 or a missing `www` loops the agent forever |
| open the gate a fixed time after the brief command | a slow `www` lets a call pass while it runs, and a failed retry after a cut read was refused twice |
| open the gate after a count of refused calls | a batch can hold any number of calls, so no count tells a call in the brief command's batch from a later one |

## Consequences

- A session whose `www` fails goes on without its brief, and the reason is in `www`'s own output, already in context.
- When the permission step refuses `www`, the gate stays shut until the turn ends. The allow rules that `www install` writes keep `www` from reaching that step.
- Claude Code takes a sixth hook entry, for `PostToolUseFailure`. Codex fires `PostToolUse` after a failed shell call too, as its docs say, and the hook sorts the call by its output. The Codex docs do not say whether a rejected or sandbox-refused call fires any hook, so the gate closes that case at the end of the turn on both hosts.
