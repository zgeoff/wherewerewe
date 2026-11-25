# www

`www` keeps the goal, the owner's grant and your open work in a brief that survives a compaction.

When to run it:

- Run bare `www` at the start of work, after each compaction, and whenever you are unsure. After a
  compaction the hooks hold your other calls until you have read the whole brief.
- Start a session with `www init <name> --goal "<what done means>"`. `www sessions` lists the names
  in use.

Write as you go, one claim per id:

- `www task`: work to do. `www now <id> "<next step>"` sets your focus.
- `www wait`: what you wait on, such as a CI run.
- `www rule`: how to do the work here, and why.
- `www where`: where a thing lives and how to stop it, such as a worktree path.
- `www lesson`: a move to repeat, with the mistake behind it.
- `www promise`: something you owe someone, and by when.
- `www words`: the owner's exact words, kept whole.
- `www decide`: a choice and the reason for it.
- `www grant`: what the owner lets you do, in their words.
- `www pin "<sentence>"`: what kind of thing the work is for, in one line.
- `www done <id> --evidence "<PR, commit or test run>"` and `www drop <id> --why "<reason>"` close
  an item.

`www` holds what is true now and where the rest lives. Keep the content in files that `www where`
rows point to. A note like "axis done; key half done; table waits on the feed" reads better as:

| Part  | State             |
| ----- | ----------------- |
| axis  | done              |
| key   | half done         |
| table | waits on the feed |

A refusal's first line is its reason and its last line is its fix: a `Run:` line to run as printed.

A subagent's shell and a plain terminal have no session of their own: pass `--session <name>` there.

Before you stop, write what is still open. `www help` lists every command.
