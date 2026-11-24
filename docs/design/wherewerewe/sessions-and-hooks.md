# Sessions and hooks

- **Status:** agreed
- **Decision records:** [0002](../../decisions/0002-sessions-bind-by-agent-session-id.md), [0004](../../decisions/0004-hooks-install-once-per-machine.md), [0007](../../decisions/0007-hooks-do-not-build-on-agent-hooks.md), [0013](../../decisions/0013-the-hooks-gate-until-the-agent-reads-the-brief.md), [0014](../../decisions/0014-the-gate-fails-open.md), [0015](../../decisions/0015-a-post-tool-hook-marks-the-brief-read.md), [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)

The owner runs several agent sessions on one machine, and each can keep its own wherewerewe session. A binding file maps an agent session's id to the wherewerewe session it writes to. A command finds the id in its environment, and a hook finds it in its stdin. See [store.md](store.md) for the file formats, [brief.md](brief.md) for the brief `www` prints, and [commands.md](commands.md) for the commands and refusal texts named here. After each start, resume and compaction of a bound session, the hooks put the goal and the grant in context and refuse the agent's tool calls until it reads the brief whole with `www`. The hooks are installed once for the machine and print nothing for an agent session with no binding. Build session finding, the bindings, the hooks, `www install` and `www doctor` from this doc, in the slice [build-order.md](build-order.md) names.

## Shape

```mermaid
flowchart LR
  cmd[www command] -->|"--session, WHEREWEREWE_SESSION, or env id"| find[find session]
  hook[wherewerewe hook] -->|"session_id on stdin"| find
  find --> bind[(.bindings/harness-id)]
  bind --> store[(the session's store)]
  hook -->|"SessionStart: goal, grant, one line"| ctx[agent context]
  hook -->|"PreToolUse, PostToolUse, Stop"| gate[(.gate/harness-id)]
  hook -->|"PostToolUse: PR, bind, nudge"| store
```

## Contracts

### How a command finds its session

```ts
// sessions module
const session = findSession({ flag: argv.session, env: process.env });
// → { name: 'tide-alerts', via: 'binding', agent: { harness: 'claude', id: '4f1c…' } }
//   or { error: 'no-session', sessions: ['tide-alerts', 'docs-move'] }
```

The first rule that gives a name wins:

1. `--session <name>`.
2. `WHEREWEREWE_SESSION=<name>`.
3. `CLAUDE_CODE_SESSION_ID`, looked up as `.bindings/claude-<id>`.
4. `CODEX_SESSION_ID`, or `CODEX_THREAD_ID` when that is unset, looked up as `.bindings/codex-<id>`.

The agent variable that gives the session also gives the brief's limit, and a command with no agent variable takes the limit of no known host ([brief.md](brief.md#the-briefs-limit)).

With no name, the command exits 4 with the no-session text in [commands.md](commands.md). The tool never falls back to a default or to the only session on the machine.

A binding file holds one line, `name=<session>`, and its file name is `<harness>-<agent session id>`, with the id restricted to `[A-Za-z0-9-]`. One agent session binds to one wherewerewe session, and one wherewerewe session can have many bindings.

| Command                       | Binding                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `www init <name> --goal "…"`  | creates the store, then binds the agent session id from the environment, when there is one |
| `www import <name>`           | converts the store, then binds, as `init` does                                           |
| `www attach <name>`           | binds this agent session id to an existing store, replacing any binding it had            |
| `www detach`                  | removes this agent session id's binding; the store stays                                  |

Each bind and detach adds a `bind` journal row with the harness and id in `extra`.

### What each agent gives

| Fact                                                                 | Claude Code                                   | Codex CLI                                     |
| -------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Session id in a shell command's environment                         | `CLAUDE_CODE_SESSION_ID`, equal to the hook's `session_id` (docs) | `CODEX_SESSION_ID` and `CODEX_THREAD_ID`, both equal to the thread id, which a compaction keeps (seen in Codex 0.169.1) |
| Session id on hook stdin                                             | `session_id`                                  | `session_id`                                  |
| A subagent's shell sees the parent's id                              | yes: a subagent of this design's own session saw the parent's `CLAUDE_CODE_SESSION_ID`, and its tool calls carry `agent_id` | the docs say subagents report the parent's id, and document `agent_id` on no tool event; not tested |
| The id changes                                                       | on `/clear` (docs); resume and fork not documented | not documented                           |
| Hook output put into context                                         | 10,000 characters of plain stdout; past that, a 2,000-character preview ([hooks](https://code.claude.com/docs/en/hooks)) | about 2,500 tokens, which a handler's `additionalContextLimit` raises (docs) |
| Shell output that reaches the model whole                            | 30,000 characters; past that, a file path and a 2,000-character preview (measured on 2.1.331) | 39,000 bytes with `max_output_tokens` at 10,000 or absent, and the model sets that parameter itself, at 1,000 to 6,000 when nothing names it; past 39,000 the middle is cut (measured on 0.169.1) |

The design works whichever way the unknowns fall:

- The `PostToolUse` hook binds the `session_id` from its own stdin whenever it sees a successful `www init`, `www attach` or `www import` command. So when a Codex shell's id differs from its hook's id, both ids get a binding.
- A subagent whose shell has no bound id gets the no-session refusal. In Claude Code, the `SubagentStart` hook gives it the name first, by adding `This session keeps its notes in wherewerewe session <name>. When a www command says there is no session, add --session <name>.`
- After `/clear`, or a resume or fork that changes the id, the new id has no binding, and the hooks stay silent. The agent, or the owner with `! www attach <name>` in Claude Code, binds it again. The no-session text names `www attach`.

### The hooks

One command handles every event, so the hook entries never change between versions and Codex never asks for trust again: `<bun> <bin> hook claude` or `<bun> <bin> hook codex`. `<bun>` and `<bin>` are the absolute paths that `command -v bun` and `command -v wherewerewe` printed at install: stable links that upgrades keep, and that work when a hook's `PATH` lacks Bun.

| Event           | Claude Code entry                          | Codex entry                                | What a bound session gets                                                                                       |
| --------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `SessionStart`  | no matcher, timeout 5                      | no matcher, timeout 5                      | `wiped` in its gate file, and on plain stdout the goal, the grant and the two lines of the refusal, as [The gate](#the-gate) says; on every source: startup, resume, clear, compact, fork |
| `PreToolUse`    | no matcher, timeout 3                      | no matcher, timeout 3                      | the refusal, or the one line of the fail-open path, as [The gate](#the-gate) says                               |
| `PostToolUse`   | matcher `Bash`, timeout 5                  | matcher `Bash`, timeout 5                  | the read check, a pull request record, a binding, or one nudge line, as below                                   |
| `SubagentStart` | no matcher, timeout 5                      | no matcher, timeout 5                      | the one line naming the session, as `additionalContext`                                                          |
| `Stop`          | no matcher, timeout 3                      | no matcher, timeout 3                      | the refusal, while the gate file says `wiped`                                                                    |

For a bound session whose store needs `www import`, a hand-kept or a format 1 store, `SessionStart` prints only the two lines of the refusal. `www` prints the exit 5 text from [commands.md](commands.md), and the gate opens on the next call ([The gate](#the-gate)).

`PostToolUse` does these, in order, and prints at most one JSON object, `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"<line>"}}`:

0. When the command is the brief command and its output is a whole read ([What counts as a whole read](#what-counts-as-a-whole-read)), it writes `read` to the gate file. This step runs for a bound id with a gate file only.
1. When the command runs `www` or `wherewerewe` with `init`, `attach` or `import` and a session name, and that session's store exists, it binds its stdin `session_id`. This is the only step that runs for an unbound id.
2. When `tool_input.command` runs `gh pr create`, it finds the first `https://github.com/<owner>/<repo>/pull/<n>` in `tool_response`, read as text whatever its shape, and appends `<owner>/<repo>#<n>` to the bound session's `prs.tsv` with a `pr` journal row, unless the ref is there already.
3. When the command runs `git push`, `gh pr create` or `gh pr merge`, the last write was more than 20 minutes ago, and the last nudge was more than 20 minutes ago, it prints the nudge and sets `last_nudge`:

```text
wherewerewe: you pushed or merged, and the last write to tide-alerts was 47m ago. Record it: www set <id> "<claim>" or www done <id> --evidence "<PR or commit>"
```

```ts
// hooks module: one parser per harness, one handler per event
type HookInput =
  | { event: 'SessionStart'; harness: Harness; sessionID: string; source: string | null }
  | { event: 'PreToolUse'; harness: Harness; sessionID: string; agentID: string | null; toolName: string; command: string | null }
  | { event: 'PostToolUse'; harness: Harness; sessionID: string; agentID: string | null; command: string; response: string; exitCode: number | null; maxOutputTokens: number | null }
  | { event: 'SubagentStart'; harness: Harness; sessionID: string }
  | { event: 'Stop'; harness: Harness; sessionID: string; agentID: string | null; stopHookActive: boolean };

type Harness = 'claude' | 'codex';
```

### The gate

The gate refuses a bound agent session's tool calls after each start, resume and compaction until the agent has read its brief whole with `www`. The hooks put only the goal, the grant and one line into context, and the agent reads the rest by running `www`, so no host's limit on hook output bounds the brief. [0013](../../decisions/0013-the-hooks-gate-until-the-agent-reads-the-brief.md) Every Codex claim in this section rests on the Codex docs. Codex runs a project hook only after a person trusts it, so no Codex hook has run, and slice 4 proves each claim on a real Codex session ([build-order.md](build-order.md)).

The gate uses `SessionStart`, `PreToolUse`, `PostToolUse` and `Stop`, on both hosts. `SessionStart`, `PreToolUse` and `Stop` take no matcher, so `PreToolUse` reaches every tool. On Codex, the docs say that covers shell calls, `exec_command`, `apply_patch`, MCP tools and local function tools such as `spawn_agent`. Hosted tools such as web search never reach a hook, and a `write_stdin` poll is not gated again. `PostToolUse` keeps its matcher `Bash` and its other jobs, and adds the read check. The `SubagentStart` line is unchanged.

The gate acts only for an agent session id that has a binding and a gate file. An unbound id and a bound id with no gate file pass every call silently. A bound id gets its gate file at its first `SessionStart` after it is bound, so a session that runs `init`, `attach` or `import` mid-session is gated from its next resume or compaction. An agent session that never opted in is untouched, as [0004](../../decisions/0004-hooks-install-once-per-machine.md) requires.

Each gated agent session has one gate file, `<root>/.gate/<harness>-<agent session id>`, beside `.bindings/`. It holds one line, `state=<state> at=<UTC time>`, and each hook replaces it through a temporary file and a rename. `www` never writes it.

```ts
// hooks module: the gate file's one line
type GateState =
  | 'wiped' // SessionStart wrote it: the brief is not in context
  | 'tried' // PreToolUse let the brief command through, and PostToolUse has not seen a whole read
  | 'read' // PostToolUse saw the main agent read this session's brief whole
  | 'cut' // on Codex, the brief command's output reached the model cut; PreToolUse refuses once more
  | 'open'; // the brief command ran with no whole read after it, so calls pass until the next SessionStart
```

When each hook writes a state:

- `SessionStart` writes `wiped` for a bound id, on every source: `startup`, `resume`, `clear`, `compact` and `fork`. After `clear` or `fork` the id can change, and a new id has no binding, so nothing is gated.
- `PreToolUse` writes `tried` when it lets the brief command through while the state is `wiped`.
- `PostToolUse` writes `read` on a whole read, whatever the state.
- `PostToolUse` writes `cut` when a Codex brief command's output was cut, once per wipe.
- `PreToolUse` writes `open` on the first call after `tried`, or after a second cut read, that is not a `www` command.

A shell command whose first word is `www` or `wherewerewe`, bare or as an absolute path ending in that name, passes the gate in every state, pipes and redirects included, so the agent can run the `Run: www import <name>` line of an exit 5. A Codex command wrapped as `<shell> -lc '<command>'` is read inside the wrapper. The brief command is narrower: `www` or `wherewerewe` alone, or with `--session <name>` where `<name>` is the session bound to this id, with nothing after it. Only the brief command moves `wiped` to `tried`, so `www help` and `www | tail -1` never open the gate. `www --json` is a `www` command, so it passes in every state, but it is not the brief command: it never writes `tried`, and `PostToolUse` never counts it as a whole read.

`PreToolUse` denies with `permissionDecision: "deny"`, and `Stop` blocks with `decision: "block"`. Both give this reason, one line, a line break, and the `Run:` line:

```text
wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.
Run: www
```

On Codex, the `Run:` line is `Run: www   (pass max_output_tokens 10000, so the whole brief reaches you)`, and the `SessionStart` line ends the same way ([brief.md](brief.md#the-briefs-limit)). After a cut read, the Codex reason's first line is `wherewerewe: www's output reached you cut, so tide-alerts's brief is not whole in your context.`, with the same `Run:` line. The reason states what is true and the command that fixes it. It never tells the agent to hold back or to ask ([0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md)). Claude Code shows it to the model as `PreToolUse:Bash hook error: <reason>`. On Codex, the docs say a `Stop` block's reason arrives as a new user prompt.

For a bound id, `SessionStart` prints on plain stdout the `GOAL` block and the `GRANT` block exactly as the brief prints them, whole and never cut, then the two lines above. It reads only the `session` file, runs no check, and prints nothing else of the brief. For a store that needs `www import`, it prints only the two lines, and `www` gives the exit 5 text. The worst case is 3 goal lines, 23 grant lines and the 2 refusal lines: about 1,610 UTF-8 bytes, 16% of Claude Code's 10,000 characters and about 400 tokens by Codex's own count, 16% of its default 2,500. Both hosts add plain stdout from `SessionStart` to context.

#### The injected grant authorises nothing

The goal and the grant in context keep what the owner allowed in front of the agent after a compaction. They are not a way to show Claude Code's auto mode classifier that the owner allowed anything. The classifier sees user messages, tool calls and CLAUDE.md, and tool results are stripped from its requests. The docs do not say whether it reads hook-added context, and the one documented hook channel to it, `classifierContext`, is unverified and never establishes user intent. The tool never writes `classifierContext`, and the owner keeps the grant in the injection and in the brief's never-cut lines.

The owner's own acts carry authority: an allow rule the owner installs and a `/goal` the owner pastes ([0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)). Scripted Claude Code sessions in auto mode, each with a standing permission given in one place, then a compaction, then the permitted action, gave these counts of the classifier's allows and blocks:

| Where the permission was | Allowed | Blocked |
| --- | --- | --- |
| no permission given (control) | 0 | 6 of 6 |
| a user message before any compaction (control) | 3 of 3 | 0 |
| the compaction summary, which restated it | 2 of 2 | 0 |
| the user's original message, with a summary that left it out | 0 | 2 of 2 |
| the command text of a tool call | 0 | 4 of 4 |
| a `/goal` condition, after a compaction | 0 | 2 of 2 |
| a `/goal` condition, before any compaction | 1 of 1 | 0 |
| `SessionStart` hook context | 0 | 2 of 2 |

The classifier kept the permission across a compaction only when the compaction summary restated it. With the owner's words in front of it after every compaction, the agent can restate them accurately when it next writes a summary, and that is what the injection is for. The owner's paste of the text from [`www goal --paste`](commands.md#www-goal---paste) carries authority before a compaction, and after one only when the agent's summary restates the grant. Whether a goal's periodic re-injection counts after a compaction is untested ([open questions](#open-questions)).

#### Subagents and failing open

A `PreToolUse`, `PostToolUse` or `Stop` payload that carries `agent_id` passes, and its read never counts. Claude Code sends `agent_id` on a subagent's tool calls. Codex documents `agent_id` only on `SubagentStart`, `SubagentStop` and the model-request events, and gives a subagent's hooks the parent's `session_id`. So on Codex, as documented, a subagent's calls pass on the parent's state, which is `read` or `open` whenever the parent could spawn it, and a subagent's whole read would write the parent's `read`. Slice 4 proves which holds.

The gate never stops an agent for long, and never refuses the same call twice in a row ([0014](../../decisions/0014-the-gate-fails-open.md)):

- When a hook cannot start, fails or times out, both hosts run the call. `www install` never sets `onFailure: "block"`.
- When a Codex read was cut, the state is `cut`, and the next call that is not a `www` command is refused once with the cut reason. A second cut read counts as no whole read.
- When the brief command ran and no whole read followed, the next call that is not a `www` command writes `open`, passes, and adds this line once as `additionalContext`: `wherewerewe: www printed no whole brief for tide-alerts, so this session's tool calls go through until the next compaction.` That covers `www` missing from the agent's `PATH`, a permission prompt that refused it, a crash, exit 4, exit 5, and a brief over the host's limit. `www`'s own output, already in context, says why.
- `Stop` blocks only while the state is `wiped`, and never when `stop_hook_active` is true. So it blocks at most once per turn while the state stays `wiped`, on either host, below Claude Code's cap of 8 consecutive continues.

#### What counts as a whole read

`PostToolUse` writes `read` when all of these hold ([0015](../../decisions/0015-a-post-tool-hook-marks-the-brief-read.md)):

- the payload has no `agent_id`, so a subagent's read never counts;
- the tool is the shell tool, and the command is the brief command, so a piped, filtered or redirected read never counts;
- the host reports the call as a success: Claude Code fires `PostToolUse` only then, and fires `PostToolUseFailure` for a failed `www`; on Codex the hook reads the exit code from `tool_response`;
- the output in `tool_response` starts with the header line of the bound session, `<name> · day`, and ends with the footer line of [brief.md](brief.md);
- the output holds no host truncation marker: Claude Code's `<persisted-output>`, or Codex's `tokens truncated`;
- on Codex, when `tool_input` carries `max_output_tokens`, that number × 4 is at least the output's UTF-8 bytes, because the model sees only that much.

A hook does this check, and `www` does not, because `www` sees neither case that breaks the rule. A piped read runs `www` whole while the agent sees one line. A subagent's shell carries the parent's session id, so a subagent's `www --session build` would open the parent's gate. The hook sees the command text, the output and `agent_id`. The footer check also catches a brief over Claude Code's limit, whose `tool_response` holds only the first 29,998 characters. The header's start and the footer line are a contract between the renderer and the hook, pinned by a test. On Codex, the shape of `tool_response` for a shell call, whether it holds the output the model saw or the whole output, and whether `tool_input` carries `max_output_tokens`, are open until slice 4 records payloads.

### Install and doctor

`www install` merges the five entries of the hooks table into `~/.claude/settings.json` and `~/.codex/hooks.json`, keeps every other hook, replaces an older entry whose command ends in `wherewerewe hook claude` or `wherewerewe hook codex`, and prints what it changed. It also writes the allow rules below. It writes no other permission rule, no `onFailure`, no `additionalContextLimit` and no `bashOutputMaxChars`. `www install --print` changes nothing and prints both JSON blocks and both rules, for an owner who keeps those files in dotfiles. Neither ever edits `~/.codex/config.toml`; both print the lines it needs:

```toml
[features]
hooks = true

[sandbox_workspace_write]
writable_roots = ["/home/sam/.local/state/wherewerewe"]   # the store root, as an absolute path
```

`www doctor` checks each of these and prints one line per check, `ok` or the exact fix: `wherewerewe` on `PATH`; the five entries in both hook files, and the Bun and bin paths each entry names; the allow rules below; `hooks = true` and the store root in `writable_roots` in the Codex config; that the store root is writable from this shell, by writing and removing a probe file; and `gh auth status`. It exits 0 when every check passes, and 3 otherwise.

#### The allow rules

Claude Code's rule is `Bash(www *)`, the narrowest rule that lets every `www` command run without a prompt. The permissions docs say a trailing `*` after a space also matches the bare command, so the rule matches `www`, `www --session tide-alerts` and each write command, and no other program. An exact `Bash(www)` would miss the `--session` form of the brief command and every write.

- The rule does not cover `wherewerewe`, an absolute path to `www`, `bash -c 'www'`, or `www` after a leading variable assignment outside the docs' known-safe set. The skill and every `Run:` line name `www`, so the agent's usual form is covered.
- In a compound command every subcommand must be allowed, so `www | tail -1` runs without a prompt only because `tail` is a read-only command.
- In auto mode, the docs say actions matching an allow rule resolve immediately, before the classifier. The docs list the broad rules that auto mode drops, such as blanket `Bash(*)`, wildcarded interpreters and package-manager run commands, and a rule of the form `Bash(www *)` is not among them. Slice 4 proves the rule stays in effect for `www`.
- Before it writes, `www install` prints the exact rule and the file, such as `www install: adding "Bash(www *)" to permissions.allow in ~/.claude/settings.json`. It adds the rule once to `permissions.allow` in the user settings, `~/.claude/settings.json`, or `$CLAUDE_CONFIG_DIR/settings.json` when `CLAUDE_CONFIG_DIR` is set. It keeps every other key and rule, writes through the same temporary file and rename as the hook entries, never touches a project's settings, and writes no deny or ask rule.
- When the rule is missing, `www doctor` prints `www doctor: no allow rule for www in ~/.claude/settings.json, so Claude Code asks before each www call.` and `Run: www install`. It also reports a deny or ask rule that matches `www`, because a matching ask rule prompts even when a more specific allow rule matches the same call.

Codex's rule is `prefix_rule(pattern = ["www"], decision = "allow")` in a `.rules` file under `~/.codex/rules/`. On Codex, `allow` runs the command outside the sandbox without prompting, so the rule takes every `www` call out of the sandbox, and the Codex docs mark rules experimental. `www install` prints the exact rule and the file before it writes, such as `www install: adding prefix_rule(pattern = ["www"], decision = "allow") to ~/.codex/rules/wherewerewe.rules`. It writes a file of its own and never edits `default.rules`, where the Codex TUI writes the rules a person allows. `www doctor` reports when the file or the rule is missing, and when the rule stops matching: it runs `codex execpolicy check --rules ~/.codex/rules/wherewerewe.rules -- www` and reports any decision other than `allow`, so a later Codex version that changes or drops rules shows up there. Slice 4 proves the rule on a real Codex session. [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)

## Constraints

- A hook always exits 0, and writes any error to `hook-errors.log`, never to stdout or stderr. Only `PreToolUse` and `Stop` block, and only as [The gate](#the-gate) says.
- For an agent session id with no binding, a hook prints nothing, writes nothing except the binding in `PostToolUse` step 1 and any error line in `hook-errors.log`, and returns in under 150 ms. A test measures the median of 20 runs. `PreToolUse`, `PostToolUse` and `Stop` treat a bound id with no gate file the same way.
- `PreToolUse` and `Stop` read at most the binding and the gate file, and return in under 150 ms for a bound or an unbound id, as the median of 20 runs. `PreToolUse` runs on every tool call in every session on the machine.
- A `PostToolUse` hook for a bound session never runs a probe and never touches the network, and returns in under 300 ms.
- A `SessionStart` hook reads only the binding and the `session` file, runs no check, and returns in under 300 ms.
- A hook reads only `session_id`, `hook_event_name`, `source`, `tool_name`, `tool_input.command`, `tool_response`, `agent_id` and `stop_hook_active` from its stdin, and on Codex `tool_input.max_output_tokens`. It ignores any other field.
- The tool never writes `classifierContext`.
- `install` is idempotent: a second run changes nothing and says so.
- A hook never creates a session or a store. Only `init` and `import` do.

## Owner steps

[README.md](README.md) lists each owner step for the whole build. The ones in this part:

1. The build agent runs `www install`, which writes the hook entries into `~/.claude/settings.json` and `~/.codex/hooks.json`, and the allow rules into `~/.claude/settings.json` and `~/.codex/rules/wherewerewe.rules`. The owner's sign-off of the design authorises it. When the owner keeps those files in dotfiles, the agent applies `www install --print` there instead.
2. The build agent adds the two lines above to `~/.codex/config.toml`, under the same sign-off. Without them, a Codex write fails, and a Codex read still prints the brief without saving results.
3. The owner opens `/hooks` in Codex and trusts the five new entries, by hand. Codex skips an untrusted hook.

## Decisions

- **Bind by agent session id.** Both agents put the id in every shell command's environment, so a command needs no flag and two sessions on one machine never write to each other's store. [0002](../../decisions/0002-sessions-bind-by-agent-session-id.md)
- **Install once, in user settings.** A session opts in with `init`; an agent session that never does is untouched. [0004](../../decisions/0004-hooks-install-once-per-machine.md)
- **After a compaction the hooks inject the goal and the grant, and gate until the agent reads the brief.** The agent reads its state by its own act, and a hook checks that it did. [0013](../../decisions/0013-the-hooks-gate-until-the-agent-reads-the-brief.md)
- **The gate fails open.** An agent that is stopped or looping is the failure to avoid, and a separate permission check polices actions. [0014](../../decisions/0014-the-gate-fails-open.md)
- **A `PostToolUse` hook marks the brief read, and only on a whole read by the main agent.** `www` cannot see a piped read or a subagent's read. [0015](../../decisions/0015-a-post-tool-hook-marks-the-brief-read.md)
- **Authority comes from the owner's own acts.** An allow rule that the owner installs and a `/goal` that the owner pastes carry it; injected context carries none. [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)
- **The hooks have their own parser, not `@zgeoff/agent-hooks`.** [0007](../../decisions/0007-hooks-do-not-build-on-agent-hooks.md)

## Builder decides

- The regular expressions that spot `gh pr create`, `git push`, `gh pr merge` and the `www` commands in a command line.
- How `install` writes JSON: key order and indentation, as long as every other hook survives.

## Open questions

- **Does a Codex subagent's shell carry the parent's `CODEX_SESSION_ID`, do `SessionStart` and `SubagentStart` fire inside a Codex subagent, and does Codex add a `SubagentStart` hook's `additionalContext`?** Run a live test in the hooks slice to settle all three. Until then, a Codex subagent passes `--session`.
- **Does the gate work on Codex?** Slice 4's Codex proofs settle it: the refusal, the whole read, the compaction source, and `tool_response`. Until then, every Codex claim in [The gate](#the-gate) rests on the docs.
- **Does a call in the same batch as `www` reach `PreToolUse` before `PostToolUse` writes `read`?** When it does, that call opens the gate with a false line. In Claude Code, the second call's hook ran after `www` finished in the one batched run. Measure the hook log's times in sessions where the model batches calls, on both hosts.
- **Does a goal's periodic re-injection carry a permission across a compaction?** A `/goal` condition was blocked in 2 of 2 runs after a compaction and allowed in 1 of 1 before one, and those runs did not test the goal's re-injection. Run the scripted auto mode sessions with a pasted `www goal --paste` text, a compaction, and enough turns for the goal to re-inject, and count the classifier's allows and blocks. Until then, the paste carries authority only until the next compaction.
