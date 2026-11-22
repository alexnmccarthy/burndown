# Burndown

**The plan burns down. So does the window. Burndown keeps both in view.**

A [Claude Code](https://claude.com/claude-code) mod that adds one row above the prompt:

```
This window ≈$3.10 ▂▃▅▇ ▓▓▓▓░░░░ 62% context │ 7d 57% · resets in 2d 2h      Handoff  ● 3/8 Wire payment step ⌄
```

- **Context** used, coloured as it fills.
- This window's **spend** (Claude Code's own estimate, as `/cost` shows it), and on Pro and Max your **rate limit** and when it resets.
- **Where the plan stands**, read from the task list Claude already keeps. Nothing to set up. Press the chip for the plan card; with no plan, **Track** asks Claude for a task list.
- **Handoff**: when the window gets tight, one press asks Claude for a short brief. A second press starts a fresh window with that brief in the prompt, ready for you to read and send.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install burndown --marketplace alexnmccarthy/burndown
```

Answer `y` to add the marketplace, then press Enter for the user scope. It's live right away, with no restart and no settings.

From a shell:

```bash
claude plugin install burndown --marketplace alexnmccarthy/burndown
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace**, enter `alexnmccarthy/burndown`, then **Add plugin**.

## What it can touch

`claude plugin validate` lists every call a mod makes. Burndown's whole list:

```
$.session.usage  $.state  $.ui  $.clock.now  $.prompt.fill  $.prompt.submit  $.command.run
```

- No file access, no network, no shell, no model calls of its own. Nothing is written to disk.
- It sends a prompt only when you press **Handoff**, and runs `/clear` only when you press **Start next window**.
- It can't block a tool call or a prompt, even if it fails.
- The spend shown is Claude Code's own estimate (the same figure as `/cost`), not a bill.

## Uninstall

```
/plugin uninstall burndown
```

## Read more

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): what's built and why.
- [`docs/ADVERSARIAL-REVIEW.md`](docs/ADVERSARIAL-REVIEW.md) and [`docs/ADVERSARIAL-REVIEW-2.md`](docs/ADVERSARIAL-REVIEW-2.md): two independent attempts to kill the plan, and what they changed.

## License

MIT
