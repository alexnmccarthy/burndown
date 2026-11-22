# Burndown: adversarial review (of plan v1)

> This review challenged v1 of the plan. Its findings are folded into [ARCHITECTURE.md](./ARCHITECTURE.md) v2 (see §0 there). Section references (§n) point at v1.

Reviewed: `docs/ARCHITECTURE.md`, the mockup `Main.dc.html` (markup and the data/copy in its script), and the mod API for build 2.1.330 (`plugin-authoring/types/claude-code.d.ts`, `reference.md`, `examples/`). Web search was used for alternatives.

Each claim is tagged **VERIFIED** (checked against a file, type or source; the location is cited) or **JUDGMENT** (my opinion).

## Verdicts

| # | Question | Verdict | One-line reason |
|---|---|---|---|
| 1 | Can Claude Code do this? | **Partly** | The bar, ledger and dock all work. The widget can't be the click target the plan makes it. Copy-and-clear and prefill-at-`session.start` break on documented behavior. `$.command.run` is called with the wrong argument. |
| 2 | Will it look right? | **Partly** | "Structure not pixels" is honest. But the canvas is a pixel design that sells radius, shadow and type, and the real mod will look like the host. The canvas over-promises, and the plan misses `size`/`weight` on `Text`. |
| 3 | Will it fit on different screens? | **Partly** | The band tiers by `bodyColumns` are sound. The surface table is wrong for narrow terminals and VS Code, and nothing handles long titles, 7+ steps or wide money values. |
| 4 | Is this useful? | **Partly** | Context % plus a durable handoff is useful. Cost per step is not a number anyone acts on, especially on a subscription. The plan list duplicates Claude Code's built-in task list. |
| 5 | Product-market fit? | **No (as a product) / Yes (as a portfolio piece)** | It's a crowded free niche (ccusage, ccstatusline, at least 8 handoff plugins) with no buyer. The segment is real but hard to reach. |
| 6 | What to improve? | — | Ranked list at the end. The top 3 change the architecture: adopt the built-in task list, show rate limits rather than dollars on a subscription, and make the widget a glance with no clicks. |

---

## 1. Can Claude Code do this? — Partly

### §2 table, row by row

| Plan row | Finding | Tag |
|---|---|---|
| Bar via `AbovePrompt`, props `bodyColumns/maxRows/isWorking/isCollapsed` | Correct. Two things are missed. The band is **shared**: each plugin draws a row, `AbovePromptList` stacks them, and another plugin can remove yours. "A row past the limits of the band… nothing was drawn". In fullscreen the slot is "capped at half the terminal's rows, the prompt's included". | VERIFIED (d.ts `AbovePrompt`, ~L13534–13600) |
| `$.session.usage()` free, `cost.usd`, `context.percent` | Correct: "The plain call costs nothing". `cost` is "absent only where the host keeps no cost ledger", so the code must handle `undefined`. `context.percent` is optional too. | VERIFIED (`SessionUsage`, `usage:` doc ~L3398) |
| Cross-window total | The engine's total **starts over** on `/clear`, `/resume` and a new process, and on resume "is swapped for a stored one". `startedAt` for a resumed session is its *first* launch. If the ledger sums `cost.usd` per window naively, it double-counts resumed sessions and loses the pre-`/clear` part unless it snapshots on `session.end`. | VERIFIED (d.ts ~L331, `SessionUsage.startedAt`) |
| Sparkline from deltas at `prompt.submit` / `turn.complete` | `turn.complete` fires for **subagent turns too** (`agentId`), so you must filter `agentId === undefined` or get duplicate samples. Background subagents and other mods' `$.model` calls land between your samples (see Attribution). `TurnCompleteFields.usage` gives token counts per turn, but no dollars. | VERIFIED (`TurnCompleteFields`) |
| `Svg` in the band | The terminal has no `Svg`. VS Code "always draws an image" (no hover or tooltip). The desktop band is still a SPIKE. The mockup's sparkline tooltip ("Cost per turn · last $0.62 · average $0.36") is lost in VS Code and the terminal. | VERIFIED (`Elements`, `SvgProps.isInteractive`) |
| Context meter via `Progress` | Mobile gets a `Progress` "only if it named it in `draws`… its Box and Text otherwise". `label` is required. | VERIFIED (`Elements.mobile`, `ProgressProps`) |
| Widget via `$.ui.open({ placement: 'widget' })` | It's "a request, which a surface with no widgets ignores". Only the desktop has widgets. "Draw what reads at a glance there: **clicks may not reach it**." `anchoredEdges` is a hint, and "no call moves a widget". | VERIFIED (`Pane.placement`, reference.md) |
| §5.2 "the glance becomes the card, and **clicking it** opens the full view" | **Contradiction.** The same API sentence the plan quotes says clicks may not reach the widget. The glance can't be the way into the dock. Open the dock from the band chip, `/plan`, or the host's own un-minimize. | VERIFIED |
| Row expand via `Button` + `Box hover` in the dock | Works. `hover` needs a keyed Box in the hook's own answer. | VERIFIED (`BoxProps.key/hover`) |
| `plan_update` / `plan_add_fix` via `$.tool.register` | Works, but the tools surface as `mcp__<plugin>__<name>`, may be deferred behind ToolSearch, and registration "Rejects until the session binds, at `session.start`". The bigger issue: **the built-ins `TaskCreate`/`TaskUpdate`/`TaskList`/`TodoWrite` already exist** (status, blocks, owner, free `metadata`), and the task list survives compaction (`docs/task-list-across-compaction.md` is referenced). See §4. | VERIFIED (d.ts L23303–23355, L23505) |
| Handoff via `$.model.fork` | Works. The prefix is "billed afresh once the entry lapsed", which is likely right when someone comes back to hand off after a break. Fork returns `nothing-to-fork` after `/clear`, so fork *before* clearing. A fork "thinks as hard as the session does". Pass `effort` or ask for haste. Its cost lands in `session.usage().cost` and gets attributed to whatever step is `flight`. | VERIFIED (`fork` doc, reference.md L265) |
| "Copy and clear": `$.ui.copy` then `$.command.run({ name: 'clear' })` | Three problems. (a) **Wrong argument**: `CommandRunInput` takes `command`, not `name`. (b) `$.ui.copy`: "The terminal writes as /copy does; **a remote surface has no path yet**" (ui.copy doc), while `UiCopyResult` mentions a remote app's clipboard. So copy on the **desktop**, the main surface for this audience, is unproven. (c) `/clear`: `$.command.run` runs commands "as if the person typed", `$.command.list` includes built-ins, and it "rejects… inside a hook the turn waits on". It's probably allowed from a button press, but that needs a spike. | VERIFIED (a, b) / JUDGMENT (c) |
| Prefill: read the handoff at `session.start`, then `$.prompt.fill` | **Broken for the main path.** "`clear`… the process goes on under a new session id, and **no `session.start` fires** for it." Do it in the same press handler: write the file, `$.command.run({command:'clear'})`, then `$.prompt.fill(...)`. That makes the clipboard unnecessary. `fill` returns `isFilled:false` under a dialog. Open question: are `$.tool.register` registrations still there after `/clear`? | VERIFIED (`SessionEndInput.reason`, reference.md L27) |
| GitHub via `$.process.run(['gh',…])` | Fine. Never call it inside `ui.render`: "a `ui.render` hook held 30 s in all by its `$` calls is skipped". Fetch elsewhere and cache in `$.state`. | VERIFIED (reference.md L256) |
| Slash commands `/plan …`, `/handoff`, `/cost-bar` | "A built-in's name is refused." Check `/plan` against `$.command.list()` on the target build, because plan mode is a first-class built-in concept. | VERIFIED (refusal rule) / JUDGMENT (collision) |
| Persistence via `$.store` | 4 MiB total of JSON. Fine for ledgers if you prune. `$.state` is readable by **any plugin** ("Any plugin reads any value"). | VERIFIED (`store.set`, `state` doc) |

### Limits the plan missed
- **Redraw rate:** `$.ui.invalidate` allows "ten a second at most, thirty in the terminal". `$.state` reads subscribe automatically, so don't invalidate per token. VERIFIED.
- **Pane placement on the terminal:** an un-asked pane is placed "from 144 columns, 110 for one once asked. Below that it waits undrawn". The plan's "narrow terminal → inline pane, `rows: 8`" only shows up after the person opens it. VERIFIED (`ui.open` doc).
- **Rate limits exist:** `SessionUsage.rateLimits` gives `five_hour` and `seven_day` `percentUsed` plus `resetsAt` on subscriptions. The plan never uses them (see §4). VERIFIED.
- **Desktop-only pieces:** the widget, `ContextMenu` and `Backdrop` are desktop-only (plus mobile for Backdrop). VS Code has no widget and no `Client`. VERIFIED.
- **Cost-ledger semantics:** session cost includes "every mod's answered `$.model` calls" and auto mode's billed classifier calls. Your own fork, another mod's summarizer and the auto-mode classifier all show up as step cost. VERIFIED (`SessionCost.usd`).

**Strongest counter-argument:** none of this kills the product. The band, ledger, dock and handoff file are buildable today. **What breaks is the flagship interaction, the clickable floating card plus copy-and-clear on the desktop.** That's the part the mockup sells.

---

## 2. Will it look right? — Partly

| Mockup | API equivalent | Lost? |
|---|---|---|
| 22 px card radius, 2-layer shadow, 350 px card | Widget frame is the surface's own; `Box` has no radius or shadow | Lost; the host decides. VERIFIED (`BoxProps`) |
| 999 px pills (chip, Handoff, link badges) | `Button variant="primary"` gets native chrome on desktop and `[ label ]` on the terminal. Link badges become `Text backgroundColor` | Pills lost. Badge is approximate |
| Hanken Grotesk / Geist Mono | `Text mono`, `size: caption…title`, `weight` | Font family lost. **But size and weight exist, and the plan's §6 says only "no font family"**, so it under-uses the scale. VERIFIED (`TextProps`) |
| 10 px status dots (filled cobalt, hollow gray, green) | Glyphs `● ○ ✓` with `color` | Fine |
| Strike-through done rows, semibold in-flight row | `strikethrough`, `weight`, `dimColor` | Fine |
| Hover background on rows (`.prow:hover`) | `Box key + hover` | Desktop fine. Terminal has no hover |
| 72×6 px context bar, cobalt fill | `Progress color` | Fine where drawn. On mobile, if the app didn't declare it, it becomes text |
| 3 px sparkline bars, last bar cobalt | `Svg` (desktop, image in VS Code) / `▁▂▃▅▇` (terminal) | Terminal resolution is 8 levels. Fine |
| Cobalt `#2B4BEE` accent | `Color` takes raw hex. `ThemeKey` has **no neutral blue accent** (`suggestion`, `planMode`, `ide`…) | Raw cobalt on a dark terminal is low contrast (JUDGMENT). Use a theme key on the terminal |
| Card restyling via `$.theme.set({style})` | `ThemeStyle` covers only messages, headings and `ToolUse` rows. **Not panes or bands** | No escape hatch. `Client` surface modules use the same element set. VERIFIED |
| `Box borderStyle` | Only terminal styles (`round`, `single`…). Anything else draws "with no border" | VERIFIED (reference.md) |

**Is "structure not pixels" honest?** Yes for the engineering. **No for the communication.** The canvas, its captions and any README built from it promise a cobalt-and-cream card with soft shadows that no surface will draw. A viewer who installs from a canvas screenshot will feel misled. JUDGMENT. Fix: redraw the canvas from real renders (Phase 0 output), and never use the canvas in the README.

**Strongest counter-argument:** looking native is a real virtue. A mod that blends into the desktop app's chrome reads as trustworthy. The risk isn't ugliness but **density**: the mockup's 15 px text, 9 px row padding and two-line rows (title + meta) take about 2× the rows of a terminal rendering. The widget's small form will show 3–4 steps, not 8.

---

## 3. Will it fit on different screens? — Partly

**Band (`bodyColumns`).** The tiers make sense, and the ≥100 example line is about 85 cells, so it fits. Traps:
- In a fullscreen terminal from 110 columns, **the docked pane narrows the band**: `bodyColumns` is the transcript column "less the engine's five". A 140-col terminal with the plan docked lands in the 70–99 tier or lower. The two features work against each other exactly when both are on. VERIFIED (`AbovePrompt.bodyColumns`).
- **Money width.** `$3.10` is 5 cells, but cross-window totals grow: `$1,204.50` is 9 and `≈ $1.2k API value` is 17. Define a compact formatter (`$1.2k`) and a fixed-width slot, or the chip jumps on every turn. JUDGMENT.
- The `<45` tier still shows a chip. The chip text `#120` comes from the plan id, and a slug like `checkout-v2-payments` blows it out. Cap the chip at about 8 cells with `wrap: 'end'`.
- `isWorking` dims the figures, but the cost changes most *while* working. Consider leaving cost undimmed. JUDGMENT.

**Plan card.**
- **Long step titles.** The mockup titles are 15–30 characters because a designer wrote them. Claude-written titles run 50–90 ("Wire payment step to the payments API and handle 3DS redirect"). Use `wrap: 'end'` with `maxLines: 1` in the glance and `maxLines: 2` in the dock. Desktop and VS Code "always cut the end". VERIFIED (`TextProps.wrap`).
- **7+ steps.** The mockup has 8 rows plus a sub-fix plus a 3-button footer. Even the mockup caps the card at `max-height: 420px` under 900 px and scrolls. Rule: show the in-flight step, next, and the last done step; "+5 more" opens the dock.
- **Link badges** (`PR #131`) sit right-aligned on every row. At a dock width of about 40 cells, title + badge + cost don't fit on one line. Drop badges into the meta line in narrow seats.

**Surfaces** (correcting §5.3):

| Surface | Plan says | Reality |
|---|---|---|
| Desktop | Svg sparkline, widget → dock | Widget needs click-free design. Svg in band is a SPIKE |
| Terminal ≥110 | Dock | Dock opens unasked only ≥144; 110 once asked. VERIFIED |
| Terminal narrow | Inline pane `rows: 8` | Only after the person opens it. It competes with the band for the half-height slot |
| VS Code | "as desktop, minus the widget" | Also: Svg is an image (no tooltip), no sideways scroll, no `Client`. VERIFIED |
| Mobile | Compact bar, inline glance | `Progress` may degrade to text. Text wraps a cut "unless `maxLines` is set". VERIFIED |

**Mockup breakpoints** (`@media` 1240 hides the sessions sidebar, 900 stacks the card above the composer) describe a **page the mod does not own**. Neither has an API equivalent: the mod never sees pixel widths, only `bodyColumns` and `placement`. They're harmless, but they shouldn't be read as a spec. JUDGMENT.

---

## 4. Is this useful? — Partly

**Who uses it daily.** JUDGMENT: a PM, designer or founder building prototypes or small features in the **desktop app on a Max/Pro plan**, running long multi-window tasks. That person would stop:
1. Getting surprised by auto-compaction mid-task. The context % plus a threshold nudge gives them that, and it's the strongest daily value.
2. Re-explaining the task in a new window. A durable, human-readable handoff file gives them that.
3. Pasting plan status into Slack or the ticket. Step ↔ issue links help, a little.

**Cost per step.** It's not a number anyone acts on, for three reasons:
- On a subscription (very likely this audience's plan), dollars are "≈ API value": they cost nothing marginal. The number a Max user **acts on** is `rateLimits.five_hour.percentUsed` ("will I get cut off before this epic is done?"), and the API already provides it. VERIFIED (`SessionRateLimit`). The plan ignores it.
- On API billing it's an estimate that "can run over or under… never… make a financial decision from it". VERIFIED (reference.md L265). Per-step precision (`$5.20` vs `$4.75`) implies an accuracy the attribution rule (§9.1) can't deliver.
- After the fact, you can't redo step 2 cheaper. The only cost decision made live is "stop or hand off now", which context % and rate limits answer better. Cost per step is a **retrospective / reporting** number. Its natural reader is a manager, and that's team rollups, which the plan defers.

**Overlap with built-ins** (the uncomfortable part):

| burndown | Built-in | Verdict |
|---|---|---|
| Plan steps with status, Claude updates them via tools | `TaskCreate`/`TaskUpdate` (pending/in_progress/completed, blocks, owner, `metadata`), task list persists across compaction. `TodoWrite` too | **Direct duplicate.** Two lists the model must keep in sync. VERIFIED |
| "The plan lives only in Claude's head until compaction erases it" (§1) | Plan mode writes `planFilePath`. The task list survives compaction | **The §1 premise is false.** VERIFIED (`PlanModeDetail.planFilePath`, task-list doc ref) |
| Handoff + clear + continue | Plan mode's exit offers clearing context and continuing (third-party plugins build on this). Auto-compaction | Partial overlap. burndown's file is durable and in-repo; compaction is lossy and invisible. **Real differentiation, but narrow** |
| Context %, cost | `/context`, `/cost`, `/usage`, status line JSON (`context_window.used_percentage`) | Overlap. The band is better placed on the desktop |

**Strongest counter-argument:** built-ins are scattered and invisible. Nobody keeps `/context` open, and the task list hides behind a key. A single always-visible band that ties context, rate limit and plan together is a real UX gain. But that argues for **displaying the built-in task list**, not inventing a parallel one.

---

## 5. Product-market fit? — No as a product, yes as a portfolio piece

**Alternatives** (web search, Nov 2026):
- Cost and usage: [ccusage](https://npmjs.com/package/ccusage) (the category leader, with a statusline mode), [ccusage-statusline-rs](https://github.com/ticpu/ccusage-statusline-rs), [cccost](https://github.com/badlogic/cccost), [ccstatusline](https://github.com/sirmalloc/ccstatusline) (context %, progress bar), [claude-code-usage-statusline](https://app.unpkg.com/claude-code-usage-statusline@0.5.0/files/README.md) (5-hour and 7-day bars), [cc-context-stats](https://pypi.org/project/cc-context-stats/).
- Handoff: [cc-handoff](https://github.com/rhuss/cc-handoff), [REMvisual/claude-handoff](https://github.com/REMvisual/claude-handoff) (`/handoffplan`), [marcj/handover](https://github.com/marcj/handover) (~80% context trigger), [obie/auto-handoff](https://github.com/obie/auto-handoff/wiki) (timed to cache expiry), [remembrall](https://awesome.ecosyste.ms/projects/github.com%2Fcukas%2Fremembrall) (30%-left trigger plus plan mode), [ring:create-handoff](https://skills.sh/lerianstudio/ring/ring:create-handoff) (handoff as a native plan), several on claudepluginhub. There's also an upstream feature request: [anthropics/claude-code#11455](https://github.com/anthropics/claude-code/issues/11455).
- Built-ins: `/cost`, `/context`, `/usage`, status line, plan mode, the task list.

**Gap that actually exists:** none of these is a **GUI-native mod** (band + widget in the desktop app) tying plan, context, limits and tickets together. Everything else is a terminal status line or a markdown skill. That's the wedge, and it's thin. JUDGMENT.

**Buyer vs user.** There's no buyer: it's free, and individuals don't pay for a status bar. The only party with budget pain is an **eng or product lead** who wants cost per ticket across a team. That needs team rollups and shared ledgers (deferred in §10), and it collides with the "nothing leaves the machine" promise. JUDGMENT.

**"Product people who code."** The segment is real and growing, but: (a) they mostly use the desktop app, which is where this plan's riskiest SPIKEs sit; (b) they don't browse plugin marketplaces or GitHub trending, and they find tools through people they follow on X/LinkedIn or Lenny-style newsletters; (c) they're the least likely to have `gh` installed and authenticated, so Phase 5 degrades for exactly them. JUDGMENT.

**Realistic outcome.** A well-crafted portfolio piece with a strong GIF, likely tens to low hundreds of stars, and a short adoption tail. Built-ins will absorb the context and handoff parts over time (#11455 exists). JUDGMENT.

**What would make it spread:**
1. One screenshot that answers a question people already ask: "will I hit my Max limit before this is done?" plus "this ticket took 3 windows".
2. Zero-config: it works on the built-in task list from minute one, with no new plan-file ritual.
3. A handoff that round-trips in one click on the desktop. That's the "oh" moment, if the spikes pass.

---

## Attribution accuracy (cost ledger)

All VERIFIED except where marked.
1. **Your own and others' model calls.** Session cost includes every mod's `$.model` calls, auto-mode classifier calls and compactions. The handoff fork gets attributed to the in-flight step.
2. **Subagents.** `turn.complete` fires per agent turn. A background agent finishing after the main turn shifts its cost into the *next* turn's delta, and possibly the next step's.
3. **Mid-turn step switches.** §9.1's rule gives a turn's cost to the step that was in flight at its start. With Claude closing step 3 and starting 4 in one long turn, the whole turn goes to 3. With 1-turn-per-step agents, that's most transitions. JUDGMENT.
4. **Resets.** `/clear`, `/resume` and a new process reset or swap the engine total. Without a snapshot on `session.end`, windows will be lost or double-counted.
5. **Unknown prices.** `hasUnknownPrice` means `usd` was computed at another model's rates. Surface it as "≈?".
6. **False precision.** The mockup prints `$5.20` per step and the step costs sum exactly to the total. Real data will have an unattributed remainder. Show it ("other $0.40") rather than spread it.

## Privacy and trust (public repo)
- **Costs committed to git.** The plan file stores `usd:` per step and per window and is "committed to the repo". In a public or client repo that publishes spend and work cadence. Make cost metadata opt-in or keep it in `$.store`/gitignored `.claude/plans/.ledger.json`. JUDGMENT.
- **Handoff files in the repo.** "Your call" and "Changed" are model-written summaries of the transcript. They can quote secrets, customer names or internal decisions. Default `.claude/handoffs/` to gitignored, and maybe run the `scan_secrets` tool before writing. JUDGMENT.
- **The mockup contains a real-looking account handle** in the sidebar footer (next to "· Max"). Scrub it before anything is published. VERIFIED (Main.dc.html, sidebar footer).
- **`$.state` is readable by any plugin.** Any installed mod can read plan titles and costs. Say so in the README, or keep sensitive fields out of `$.state`. VERIFIED.
- **`gh` runs with the user's GitHub auth.** It's read-only, but document exactly which commands run. The "no network beyond gh" promise is good. Add a test that fails if `$.http` is imported. JUDGMENT.

## Scope creep in the mockup (beyond "just the widget and the bar")
VERIFIED from the mockup source:
- The scenario switcher includes **New chat start cards**, **Queue of 5 tickets**, a **Recent sessions sidebar**, and "Next ticket" / "End queue" labels. The plan excludes them, but they still live in the canvas and its captions.
- **Window history** (`showWin`, "Window 1 · audit and plan $5.20 …"): a per-window breakdown panel.
- **Live test counts** ("54 tests passing") and **files changed** per step. No data source in the plan; it would mean parsing Bash output.
- **"Save to repo"** next to "Copy and clear" is a second handoff action with unclear difference.
- **Three footer actions** (Handoff · Stop tracking · Cancel plan) plus an Undo row. "Stop" vs "Cancel" is a distinction users won't hold.
- Model and project chips in the composer belong to the host, not the mod. Make sure nobody builds them.

---

## 6. Ranked improvements

1. **Adopt the built-in task list as the plan source.** Read `TaskCreate`/`TaskUpdate` via `tool.call` hooks and `$.tool.call({tool:'TaskList'})`, and plan mode's `planFilePath`. Store link and cost in your own map keyed by task id (or in task `metadata`). Drop `plan_update`/`plan_add_fix`, or keep a single tool only for linking an issue. *Why:* Claude already uses these tools without prompting, they survive compaction, and Phase 2's exit criterion ("Claude keeps the plan current with no prompting") becomes free instead of the riskiest bet.
2. **Show rate limits rather than dollars on a subscription.** When `rateLimits` is non-empty, the band shows `5h 41% · resets 3:10` and the dollar figure moves to a dim "≈ API value" tooltip or dock line. *Why:* it's the number the target user acts on, and it's free from the same call.
3. **Make the widget truly click-free.** The widget shows title, a progress line, the in-flight step and next. The dock opens from the band chip, `/plan`, or the host's un-minimize. Fix the §5.2 contradiction. *Why:* the API says clicks may not reach the widget, and the current design relies on them.
4. **Redesign handoff around documented events.** One press: fork (with `effort`) → write file → `$.command.run({ command: 'clear' })` → `$.prompt.fill(nextPrompt)` in the same handler. The clipboard is only a fallback. Fix the `name` → `command` bug. Phase 0 must answer: is `/clear` allowed from a press, do tool registrations survive `/clear`, and does `fill` work right after? *Why:* `session.start` doesn't fire after `/clear`, and desktop copy has "no path yet".
5. **Reposition: lead with context and handoff, demote cost per step.** The pitch becomes "never lose the thread between windows". Cost per step moves to the dock and the handoff file as a retrospective figure, rounded to $0.10, with an "other" bucket. *Why:* §4. And dollar precision you can't defend undermines trust in a public tool.
6. **Harden the ledger.** Filter `agentId`, snapshot on `session.end` (all reasons), key windows by session id to survive `/resume` swaps, tag your own fork's cost as "handoff", and flag `hasUnknownPrice`. *Why:* the attribution section above.
7. **Private by default.** Gitignore the ledger and handoffs, keep cost metadata out of the committed plan file unless opted in, scrub the handle from the mockup, and document what `$.state` exposes. *Why:* a public repo is judged on this, and §9.4's "nothing leaves the machine" isn't true of a pushed git commit.
8. **Define the overflow rules in the spec.** Title `maxLines` per seat, a "+N more" cut at 4 visible steps in narrow seats, a compact money formatter with a fixed slot, a chip capped at 8 cells, and a band tier table that accounts for a docked pane narrowing `bodyColumns`. *Why:* §3. Real Claude titles and long epics break the mockup's happy path.
9. **Cut the mockup to the two pieces and redraw it from real renders.** Remove queue, start cards, sidebar, window history, test counts, files, "Save to repo", and Stop vs Cancel (merge into one "Stop tracking" with Undo). Replace the canvas's pixel styling with screenshots from Phase 0 for desktop, terminal at 80/120/160 columns, and VS Code. *Why:* §2 and scope creep. The README must show what installs.
10. **Make Phase 1 the band only, and make it excellent.** Context %, rate limit or cost, sparkline, threshold nudge. Ship it and measure installs before building the widget. Consider also offering it as a status-line command for terminal users who won't install mods. *Why:* it's the most useful and least risky piece, and it tests the "product people" channel cheaply before the hard desktop-widget work.
