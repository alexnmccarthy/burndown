# Burndown: architecture (v3, as built)

> One row above the prompt: how full the context is, your rate limit or spend, and where the plan stands. When the window gets tight, one press writes a handoff brief and a second press starts the next window with it.
>
> Reviews that shaped this: [ADVERSARIAL-REVIEW.md](./ADVERSARIAL-REVIEW.md) (of v1) and [ADVERSARIAL-REVIEW-2.md](./ADVERSARIAL-REVIEW-2.md) (of v2, against the goal "anyone installs it in a minute with minimal access review").

## 0. What changed from v2

| v2 said | Review 2 found | v3 does |
|---|---|---|
| A bar, a corner widget and a full view | The widget shows nothing until Claude makes tasks, is desktop-only, and needs the widest access | **The bar first, the card on demand.** The plan chip opens the card; nothing opens unasked |
| Handoff: `$.model.fork` summary, write a file, `/clear`, fill | `model.fork` spends a large prompt on a press. `fs.write` and `.gitignore` edits make a careful installer nervous | **Claude writes the brief as its reply.** The mod carries the reply into the next prompt. No file, no model call of the mod's own |
| Thresholds in `userConfig` | Any `userConfig` adds a settings screen to the install | **No config.** Fixed thresholds: context 50%, limit 85% |
| `gh` status for issue links | `$.process.run` can run any program, and that's the scariest line in the call list | **Cut.** Links are later, if ever |
| Ledger in `$.store` and a gitignored file, cost per step | Cost per step is a number nobody acts on, and on a subscription it isn't a charge | **Cut.** This window's spend, rounded, and only on an API key |
| Plan from `TaskCreate`/`TaskUpdate` | The desktop app uses its own task tool, and some hosts still use `TodoWrite` | **Three sources, one shape** (§3) |

## 1. What a reviewer sees

`claude plugin validate .` lists every call the mod makes. This is the whole list:

```
calls: $.clock.now, $.command.run, $.prompt.fill, $.prompt.submit,
       $.session.usage, $.state.get, $.state.set, $.ui.open, $.ui.resolve
```

- **No** `$.fs`, `$.process`, `$.http`, `$.model`, `$.tool.register` or `$.store`. Nothing leaves the machine and nothing is written to disk.
- `$.prompt.submit` runs only when you press **Handoff**. It sends one visible prompt asking for the brief.
- `$.command.run('clear')` runs only when you press **Start next window**, after the brief is on screen.
- `$.ui.open` runs only when you press the plan chip, to show the plan card.
- `$.prompt.fill` also runs when you press **Track**: it puts a request for a task list in the box and sends nothing.
- The two observer hooks (`prompt.submit`, `tool.call`) have a `.catch` that hands the call through untouched. Burndown can't block a tool or a prompt, even if it fails.

## 2. The bar

Laid out like the canvas, in one row sized to `bodyColumns` (which already shrinks when a pane is docked):

```
This window  ≈$3.10  ▂▃▅▇  [▓▓▓▓░░░░]  62% context  │ 7d 57% · resets in 2d 2h  │ Total ≈$17      [Handoff]  ● 3/8 Wire payment step ⌄
```

| Part | Shows | Drops below |
|---|---|---|
| Spend | "This window" and `≈$3.10` in semibold (a fixed 6-cell slot) | the label at 70 cells, the figure at 45 |
| Sparkline | spend per turn, last 12: 3 px SVG bars with the newest in cobalt; block characters on the terminal | 100 cells |
| Context | a 72×6 rounded SVG meter (cobalt, orange from 60%, red from 85%) and `62% context`; `▓▓▓░░` on the terminal | never |
| Limit | the tightest window (`5h` / `7d`) and the time to its reset, after a divider | the reset at 70 cells |
| Total | the spend of every window since this process started, from the second window on | 100 cells |
| Right | `Handoff` from 50% context or 85% of a limit, then the plan chip `● 3/8 step ⌄`, or `○ Track` with no plan | never |

The host draws the band itself: the grey container, its corners, the font and button chrome. A mod can't set those, so the canvas's tint and pill shapes don't carry over.

### The plan card
The chip opens a pane (`$.ui.open`, asked for as a widget). As a **widget** it's a glance with nothing to click: `Plan · Window 2 · step 3 of 8`, a progress meter, the step in flight and the next one. **Docked** it lists every step (done steps struck through with ✓, the current one semibold in cobalt with "In progress", "Up next" under the next one), folds finished steps once there are more than 20, and ends with the total and a Handoff button.

## 3. The plan, from the task list Claude already keeps

| Source | Where | How it's read |
|---|---|---|
| `TaskCreate` / `TaskUpdate` | terminal, VS Code | the create result adds a step; the update input changes status or title, or deletes it |
| `TodoWrite` | older builds, some SDK hosts | the whole list each call |
| `*__update_plan` | the desktop app's task list | the whole list (`items`), or a move (`advance`, `done`, `start`) |

Burndown never asks Claude to keep a second list. Subagent calls are ignored. A `/clear` empties the plan, because the task list belongs to the old session.

## 4. Handoff

1. **Handoff** (shown once context ≥ 50% or a limit ≥ 85%) submits a fixed prompt (`src/handoff.ts`): reply with only a brief under 300 words in six fields, Goal, Done, Next, Open, Watch out and Files, run no tools, include no secrets.
2. When that turn ends with an answer, the bar shows **Start next window** and **Not now**.
3. **Start next window** runs `/clear`, then fills the prompt with the brief. You read it, edit it, and press Enter. Nothing is sent for you.

No file is written. The brief stays in the old session's transcript, so `/resume` gets it back.

## 5. Layout

```
.claude-plugin/plugin.json        name, version, types
.claude-plugin/marketplace.json   makes the repo installable: source "./"
hooks/hooks.json                  { "modules": ["./register.tsx"] }
hooks/register.tsx                the wiring: six hooks, three atoms
src/meter.ts                      usage → what the bar shows (pure)
src/plan.ts                       three task tools → one plan (pure)
src/bar.tsx                       the row, tiered by width (pure)
src/pane.tsx                      the plan card: glance as a widget, full list docked (pure)
src/svg.ts                        the meter and sparkline drawings (pure)
src/handoff.ts                    the brief prompt and the next-window prompt
src/format.ts                     money, time to reset, sparkline, clip (pure)
types/index.d.ts                  the $.state contract
test/                             claude plugin test: pure tables + render on 4 surfaces
```

## 6. Checks

- `claude plugin validate .` passes and prints the call list above.
- `claude plugin test .` runs 15 tests: formatting tables, the three plan sources, the bar and the plan card mounted on terminal, desktop, VS Code and mobile, the full handoff flow, a Handoff pressed mid-turn, a refused submit, Track, and the total across a /clear.
- `tsc -p .` is clean under `strict` and `noUncheckedIndexedAccess`.

## 7. Later

- CI that fails if `claude plugin validate --json` lists a call outside the allowlist in §1.
- Maybe: a status-line command for terminal users who don't install mods.
- Not planned: `gh` links, cost per step, team rollups. Each one widens the access list.
