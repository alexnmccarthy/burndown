# Burndown

**The plan burns down. So does the budget. Burndown keeps both in view.**

A [Claude Code](https://claude.com/claude-code) mod for people who build real features across many context windows. It adds two small things:

- **A bar above the prompt** showing how full the context is, your rate limit (Max/Pro) or cost (API), and a sparkline per turn. A **Handoff** button appears before the window gets tight.
- **A plan widget** in the corner: where you are in the plan, what's next, and how many windows it has taken. Open it for every step, its issue or PR, and a one-press handoff to a fresh window.

It reads Claude Code's own task list, so there's nothing new to learn and no second list for Claude to maintain.

> **Status: planning.** Nothing installs yet. This repo is being built in the open. Start with the plan and the review that challenged it.

## Read first
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): what we're building, how it maps to the Claude Code mod API, and the build phases.
- [`docs/ADVERSARIAL-REVIEW.md`](docs/ADVERSARIAL-REVIEW.md): an independent agent's attempt to kill the plan, on six questions. Can Claude Code do it? Will it look right? Will it fit every screen? Is it useful? Is there product-market fit? What should change? Section 0 of the architecture doc lists what the review changed.

## Principles
- **Honest numbers.** Every dollar figure is labeled an estimate, rounded, with unattributed spend shown as "other".
- **Local only.** No network except read-only `gh`. Ledgers and handoffs are gitignored by default.
- **Native look.** It draws with the host app's own components, so it fits every theme and surface.

## Roadmap
0. Spike against the real desktop app and terminal
1. **The bar** (ships on its own)
2. Plan glance and full view
3. One-press handoff
4. Issue and PR links
5. Launch

## License
MIT
