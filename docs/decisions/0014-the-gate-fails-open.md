# 0014: The gate fails open

- Date: 2026-11-25
- Status: decided

## Decision

The gate never stops an agent for long, and never refuses the same call twice in a row. When a hook cannot start, fails or times out, the host runs the call, and `www install` never sets `onFailure: "block"`. When the brief command ran and no whole read followed, the gate refuses the first call after it once, because a call in the same batch can arrive before the read finishes, and opens on the next call with one line. When a Codex read reaches the model cut, the gate refuses once with the cut reason and lets the agent read again; a second cut read, or a failed read, opens the gate after one more refusal at most. `Stop` blocks at most once per turn.

## Why

- The owner's failure case is an agent that is stopped or looping, as [0008](0008-notes-the-grant-and-no-caution-steering.md) records. A separate permission check polices what the agent does.
- A failed `www` fires `PostToolUseFailure` in Claude Code, not `PostToolUse`. In a run where `www` exited 5, the next call opened the gate through the fail-open path, and no call was refused twice.
- A brief over Claude Code's shell output limit reaches the model as a preview, and `PostToolUse` sees no footer line. The same path opens the gate.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| fail closed with `onFailure: "block"` | a broken hook stops every tool call in every bound session |
| refuse until `www` exits 0 | an exit 5 or a missing `www` loops the agent forever |

## Consequences

- A session whose `www` fails goes on without its brief, and `www`'s own output, already in context, says why.
