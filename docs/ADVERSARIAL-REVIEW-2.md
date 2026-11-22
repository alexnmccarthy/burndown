# Burndown: adversarial review 2 (of plan v2)

> Reviewed against the owner's new goal: a public mod anyone installs in about a minute, with nothing scary to review. The first review ([ADVERSARIAL-REVIEW.md](./ADVERSARIAL-REVIEW.md)) is already folded into v2 and is not repeated here.

Sources: `docs/ARCHITECTURE.md` v2, the mockup `Main.dc.html`, and the mod API for build 2.1.330: `plugin-authoring/types/claude-code.d.ts` (cited as `d.ts:L`), `reference.md` (cited as `ref:L`) and `examples/band.tsx`.

Every claim is tagged **VERIFIED** (file and line) or **JUDGMENT**.

## Verdicts

| # | Question | Verdict |
|---|---|---|
| 1 | Install friction | **Good if v1 has no `userConfig`.** Three answers in the terminal, about five clicks on desktop. A config screen adds a step for nothing. |
| 2 | Access surface | **v2 is too wide for a public mod.** It uses the two nouns a careful reader fears most (`process.run`, `tool.call`) plus a silent model spend (`model.fork`) and a destructive press (`/clear`). All four can go from v1. |
| 3 | Smallest compelling v1 | **The bar.** It is the only piece that shows something true on the first screen after install, on every surface, with zero setup. |
| 4 | Will v2 still break | **Yes, in five places.** The task list has no metadata on read, the session's task list likely resets on `/clear`, subscription detection is wrong at exactly the install moment, `/clear` is queued not immediate, and the plan polls when the API pushes. |
| 5 | Annoying defaults | **Mostly polite already.** Remove the "Track" chip, never open the widget unasked before there are tasks, no toasts, give the row a Hide. |

---

## 1. Install friction

### Terminal
What a novice sees on `/plugin install burndown --marketplace alexnmccarthy/burndown` (VERIFIED, ref:177):
1. `Add marketplace?` naming `github:alexnmccarthy/burndown`. Answer `y`.
2. The plugin's details and a scope list, user scope first. Press Enter.
3. **Only if the manifest has `userConfig`:** a screen that sets the options.
4. `Installed burndown. Plugin is now active.`

So: one typed line plus two answers, or three answers with `userConfig`. v2's `plugin.json` declares `userConfig: thresholds` (ARCHITECTURE §7, §5.1). That is a whole screen to ask a novice about numbers they have no opinion on. **Cut it from v1.** Hard-code 50% context and 80% of the 5-hour window. Add `userConfig` later, when someone asks. JUDGMENT.

There is no permission prompt for the `$` nouns a hooks module uses. Nothing in the install flow lists `process.run`, `fs.write` or `tool.call` (VERIFIED, ref:177 lists every screen). That is good for friction and bad for trust: the only place a careful person sees the surface is `claude plugin validate`, the README, or the source. So the surface has to be small enough to read in the README in ten seconds. JUDGMENT.

### Desktop app
`/plugin` does not run there (VERIFIED, ref:179). The path is: click `+` next to the prompt box, Plugins, Add marketplace, type `alexnmccarthy/burndown`, Add plugin (VERIFIED, ref:173). About five clicks and one typed string. Whether the desktop flow shows a `userConfig` screen, and whether the mod is active without a restart there, is not documented. JUDGMENT: test both in Phase 0, because desktop is the main audience.

A mod installed from the terminal at user scope also loads in the desktop app's local sessions and draws for the `desktop` surface (VERIFIED, ref:179). The README can say so.

### What "hooks module only" buys
- It goes live in the current session with no reload (VERIFIED, ref:177). The first impression happens right there, so whatever v1 draws must be true on that first screen.
- No `bin/`, no MCP server, no install script, no `commands/` or `skills/` files to read. The whole surface is one module that `validate` can list. VERIFIED (ref:3-4: validate reports what the module hooks and calls).
- `validate` reports `uses.calls` as sorted `noun.method` names and `uses.hosts` for network (VERIFIED, d.ts:10049-10108). So CI can assert the exact list of calls. **Replace the planned custom "no `$.http`" grep (§7) with a check on `claude plugin validate --json`: `calls` must equal an allowlist and `hosts` must be absent.** It reuses the engine's own reader and catches every noun, not just one. JUDGMENT.

### Who cannot install it at all
- An organization with `allowManagedModsOnly` blocks a person's mods (VERIFIED, d.ts:3675). Team and Enterprise users may get nothing. The README should say so in one line. JUDGMENT.
- The API "is early access and moves between releases" (VERIFIED, ref:5), and an older Claude Code refuses newer props such as `maxLines` and `overflowX` (VERIFIED, ref:202). A public mod meets every version. **Every `ui.render` hook needs a `.catch` that draws a plainer tree.** v2 does not mention this. JUDGMENT on severity, VERIFIED on the rule.

---

## 2. Access surface

What v2 uses, how it reads to a careful installer, and whether v1 needs it.

| Noun | v2 use | How it reads | v1 |
|---|---|---|---|
| `process.run` | `gh` for issue and PR status | Runs any program on the host, no shell, any args (VERIFIED, d.ts:4291-4308). The scariest line in any `validate` report. | **Cut.** Links work as plain URLs. |
| `tool.call` (calling `$.tool.call`) | Seed the plan from `TaskList` | The op runs any tool with "every ask becomes an allow" and deny rules do not cover it (VERIFIED, d.ts:3663-3680). A reader sees `tool.call` in `calls` and cannot tell it is only `TaskList` without reading source. | **Cut from v1.** Back in v2 with a one-line README note. |
| `tool.call` (hook) | Watch `TaskCreate`/`TaskUpdate` | Listed by `validate` as a gating hook, a hook "at a site whose answer can refuse" (VERIFIED, d.ts:10233-10237, ref:67). Reads as "this mod sits in front of my tool calls". | **Cut from v1.** Back with a literal `{ tool: 'TaskCreate' }` matcher so the line reads `tool.call{tool=TaskCreate}`. |
| `model.fork` | Handoff summary | Spends the user's tokens or rate limit from a button. At 50%+ context the prefix is 100k+ tokens and is "billed afresh once the entry lapsed" (VERIFIED, d.ts:3150-3156), which is likely after a break, when people hand off. | **Cut.** Let Claude write the handoff in the main thread (see §3). |
| `command.run('clear')` | One-press next window | Ends the conversation from a button. Destructive and not undoable. | **Cut.** The person types `/clear` themselves. |
| `fs.write` | Handoff file, ledger mirror | Writes into the repo. Fine in itself, but it is the mod writing, not Claude, so no permission prompt the person knows. | **Cut.** Claude's own Write tool does it under the person's normal permissions. |
| `.gitignore` edits | Hide ledger and handoffs | Editing a tracked file in someone's repo is the most annoying thing on this list, even "after asking" (needs a dialog too). | **Cut.** No ledger in v1. The handoff prompt asks Claude to check it is ignored and say so. |
| `tool.register` | `burndown_link` | Adds a tool to every model request, under `mcp__burndown__…`, and only after `session.start` (VERIFIED, d.ts:3720-3730). Changes what Claude sees in every session. | **Cut.** Also cut from v2: Claude will not call it unprompted. JUDGMENT. |
| `store` | Ledger, `gh` cache | Harmless, local, 4 MiB. | Not needed in v1. |
| `state`, `ui.*`, `session.usage`, `prompt.fill` | Drawing, figures, prefill | Read-only or the mod's own row. Nothing scary. | **Keep.** |
| `command.register` | `/burndown` | Harmless. A built-in's name is refused (VERIFIED, d.ts:3777). | Optional in v1 (only to toggle Hide). |

### Zero-scary v1
`validate` would list, and the README would print:
- Events: `session.measure`, `ui.render{component=AbovePrompt}`, `session.end`.
- Calls: `prompt.fill`, `session.usage`, `state.get`, `state.set`, `ui.resolve`.
- Gating hooks: none. Hosts: none.

README line: "Reads the context and rate-limit figures Claude Code already shows in `/context` and `/usage`. Draws one row above the prompt. Writes nothing, runs nothing, sends nothing." JUDGMENT. That sentence is the trust pitch, and v2 cannot say it.

---

## 3. The smallest compelling v1

### The options
- **The bar.** Context and limits already exist as status lines (ccstatusline, ccusage). JUDGMENT: but a status line is a terminal setting the desktop app does not draw for custom scripts (unverified, check in Phase 0), and the mod band is drawn natively on desktop, VS Code and mobile. On desktop it is new.
- **The plan widget.** It is the novel piece. But on install it shows nothing unless the session already used the task list, it is desktop only (VERIFIED, ref:219: `widget` is the desktop app's small form), and it needs the two scariest nouns to seed and track. Zero-config, zero-scary and "shows something on first screen" cannot all be true for it.
- **One-press handoff.** The flagship in the mockup. It needs three Phase 0 spikes to pass, spends tokens, destroys the conversation on a press, and meets eight or more existing handoff plugins. A novice will not see the button on day one anyway: it appears only past 50% context.

### Argue for the bar
The bar is the only piece that is true on the first screen after install, in the same session, with no setup (VERIFIED: the mod is live at once, ref:177; `$.session.usage()` is free, d.ts:3402). The "oh" is one row that answers "will I make it?":

`[▓▓▓▓░░] 62% context · 5h limit 41%, resets 3:10 PM`

Past the threshold the row gains one button, **Write handoff**, which only fills the prompt (no fork, no clear):

> Write a handoff note to `.claude/handoffs/<date>-<slug>.md` for the next window: what is done, what is next, open decisions, files that matter. Check it is gitignored and tell me if not. Then tell me to run /clear.

The person reads it and presses Enter. Claude writes the file with its own tool. The person runs `/clear`. On `session.end` with `reason: 'clear'` the mod keeps the path in `$.state`, and the row then offers **Continue from handoff**, which fills `Read .claude/handoffs/… and pick up where it ends.` Two presses and one typed command, every step visible, no new nouns. JUDGMENT, except: `session.end` reports `clear` and no `session.start` follows (VERIFIED, d.ts:14726-14729), and its hooks share a 1.5 s bound (VERIFIED, d.ts:14718), so only a `$.state` write belongs there. Whether `$.state` survives `/clear` is a Phase 0 check.

This also deletes the hardest code in v2: `handoff/summarize`, `handoff/write`, `handoff/next-window`, the ledger, `github.ts`, and three of the five 🔬 rows. JUDGMENT.

**Ship the widget as v1.1** behind the first real install signal, with the `tool.call` hooks named in the README.

---

## 4. Things in v2 that would still break or confuse

| v2 claim | Finding | Tag |
|---|---|---|
| `$.session.usage()` has `context.percent`, `rateLimits`, `cost.usd` | All three exist. `percent` is optional and absent "until the first response of the live window", also just after a compaction (d.ts:14600-14619). `cost` is optional (d.ts:15647-15652). | VERIFIED |
| `limit: { kind: 'five_hour' \| 'seven_day'; pct; resetsAt: number }` (§4) | `kind` is a string and can also be a gateway's `spend_limit`. The field is `percentUsed`. `resetsAt` is an optional ISO string, not a number (d.ts:15175-15190). Type it from the engine's `SessionRateLimit`, do not redeclare it. | VERIFIED |
| "Subscription: shows limits. API key: shows dollars" | The only signal is `rateLimits` being non-empty, and it is "empty off a subscription **or before the first reading**" (d.ts:14933). On a fresh session a Max user looks like an API user, so the bar shows dollars and then flips. On a subscription `cost.usd` is "no charge at all" (d.ts:14638-14640). Fix: show no money until a reading exists, and never present dollars as the subscription headline. | VERIFIED (data) / JUDGMENT (fix) |
| `meter/usage poll` (§3) | The engine pushes: `session.measure` fires after each main-thread turn and when a limit moves a whole point, with `changed` units (d.ts:5867-5879, 14915-14946). Delete the poll. | VERIFIED |
| Observe `TaskCreate`/`TaskUpdate` with `on('tool.call', { tool })` and read results with `await next(e)` | Works. `next(e)` resolves to `{ result }` typed per built-in (d.ts:17778-17830). `TaskCreate`'s result has `task.id` and `subject` (d.ts:28203-28211). `tool.call` input carries `agentId` for subagent loops (d.ts:396-405), so subagents' task calls arrive too. | VERIFIED |
| Status `pending \| in_progress \| completed` (§4) | `TaskUpdate` also takes `deleted` (d.ts:23279). A deleted task must leave the list or the count is wrong. | VERIFIED |
| Links and parents from task `metadata` (§2) | `metadata` appears only on the `TaskCreate`/`TaskUpdate` input (d.ts:23248-23288). `TaskList` returns `id, subject, status, owner, blockedBy`, no metadata (d.ts:28223-28231), and `TaskGet` none either (d.ts:28213-28222). Seeding from `TaskList` loses every link. | VERIFIED |
| `$.tool.call({ tool: 'TaskList' })` is callable | The op calls any tool by name, permission asks become allows (d.ts:3663-3707). `TaskList` takes `{}` (d.ts:23262). Callable, unless `--tools` leaves it out. | VERIFIED |
| Built-in task list is the truth | `TodoWrite` is also a built-in (d.ts:23289). A session that has `TodoWrite` instead of the Task tools gives the widget nothing. Check `$.tool.list()` and either handle both or show nothing. | VERIFIED (both exist) / JUDGMENT (which a session has) |
| The plan spans windows | The doc calls it "the session's task list" (d.ts:23446). `/clear` starts a new session id (d.ts:14726-14729). If the list is per session, the widget goes blank right after the flagship handoff. Top Phase 0 check. | VERIFIED (wording) / JUDGMENT (effect) |
| `$.command.run({ command: 'clear' })` from a `ui.press` | It is "queued and run once the session is idle" and rejects "inside a hook the turn or the session's start waits on" (d.ts:3757-3764). A press is not such a hook, so likely allowed. Pressed mid-turn, the clear waits; a `fill` right after may land first and then be wiped. | VERIFIED (rules) / JUDGMENT (order) |
| `$.prompt.fill` exists | Yes: `replace`, `append`, `insert`; `isFilled: false` under a dialog or headless (d.ts:3597-3609). Handle `false` with a one-line fallback. | VERIFIED |
| `$.model.fork` after `/clear` | Returns `nothing-to-fork` (d.ts:3164). Order must be fork, then clear. Moot if fork is cut. | VERIFIED |
| `$.ui.copy` fallback on desktop | "A remote surface has no path yet" (d.ts:3029). The fallback toast "Run /clear and paste" may tell a desktop user to paste nothing. | VERIFIED |
| `burndown_link` tool | Rejects until `session.start` (d.ts:3728-3729). After `/clear` no `session.start` fires, so whether it survives is unknown. Cut. | VERIFIED / JUDGMENT |
| `userConfig` thresholds | Stored in `pluginConfigs[<plugin>].options`, validated before load; a required field with no value fails the load (d.ts:9822-9832). Each non-secret field is a `/config` row, and a change reloads the module (ref:123). Use defaults only and never `required`. | VERIFIED |
| Mockup: "$3.10 logged to #120" | Implies a GitHub write. v2 promises read-only `gh`. The mockup also has no rate-limit state at all, while v2 makes limits the subscription headline. Redraw before any screenshot ships. | VERIFIED (Main.dc.html:211; no "5h" or "limit" string in the file) |

---

## 5. Defaults that could annoy

| Default | Risk | Polite default |
|---|---|---|
| A band row always on | One more row in every session forever. In fullscreen the band shares half the terminal with the prompt (first review). | Keep one row, dim. Add a **Hide** button like the example does (examples/band.tsx:53-57) and `/burndown` to bring it back. Yield to `hasSurvey` and `isCollapsed` (already planned). |
| The "Track" chip with no plan | A button that does nothing truthful when Claude made no tasks. | Cut. Show no chip until tasks exist. |
| Widget opening at `session.start` | An unasked pane on every session, empty until tasks exist. The terminal only seats unasked panes from 144 columns (VERIFIED, d.ts:2926-2929). | Open the widget only on the first `TaskCreate` of a session, and never again once the person closes it. |
| Handoff button accent | Turns accent at 50% on a 1M-token window, long before it matters. | Threshold on `percent` and on the 5-hour limit, as planned, but no colour change before the button appears. |
| Toasts | Any toast competes with other plugins' and the engine's lines. | None in v1. Use `$.ui.status` (d.ts:2922) only if a pinned line is ever needed. |
| `.gitignore` prompt on first run | A dialog on install day, about a repo edit. | Cut (see §2). |
| Cost to the cent, "≈?" glyphs | Noise on a subscription. | No money on a subscription. On an API key, one rounded figure for this window. |

---

## Recommended v1

- **One row above the prompt:** context %, 5-hour limit with reset time on a subscription, one rounded window cost on an API key, nothing until the first reading. Fed by `session.measure`, drawn from `$.state`.
- **Past the threshold:** a **Write handoff** button that fills a prompt, and after `/clear` a **Continue from handoff** button that fills the next one.
- **No `userConfig`, no pane, no toasts, no files, no processes, no tools.** A `.catch` on every `ui.render` hook. CI asserts the `validate --json` call list.
- **v1.1:** the widget from `TaskCreate`/`TaskUpdate` hooks, once Phase 0 shows the task list survives `/clear`.
- **Later or never:** `gh`, the ledger, per-step cost, `burndown_link`, the fork, the one-press `/clear`.

## What I attacked and could not break
The band itself: `AbovePrompt` with `bodyColumns` tiers, free `usage()`, and push updates through `session.measure` all hold up against the d.ts, and a hooks-module mod really is live after three answers.
