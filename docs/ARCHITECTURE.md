# Burndown: architecture (v3, as built)

> One row above the prompt: how full the context is, your rate limit or spend, and where the plan stands. When the window gets tight, one press writes a handoff brief and a second press starts the next window with it.
>
> Reviews that shaped this: [ADVERSARIAL-REVIEW.md](./ADVERSARIAL-REVIEW.md) (of v1) and [ADVERSARIAL-REVIEW-2.md](./ADVERSARIAL-REVIEW-2.md) (of v2, against the goal "anyone installs it in a minute with minimal access review").

## 0. What changed from v2

| v2 said | Review 2 found | v3 does |
|---|---|---|
| A bar, a corner widget and a full view | The widget shows nothing until Claude makes tasks, is desktop-only, and needs the widest access | **The bar only.** The plan lives in the bar as `3/8 Wire payment step`. Widget is v1.1 |
| Handoff: `$.model.fork` summary, write a file, `/clear`, fill | `model.fork` spends a large prompt on a press. `fs.write` and `.gitignore` edits make a careful installer nervous | **Claude writes the brief as its reply.** The mod carries the reply into the next prompt. No file, no model call of the mod's own |
| Thresholds in `userConfig` | Any `userConfig` adds a settings screen to the install | **No config.** Fixed thresholds: context 60%, limit 85% |
| `gh` status for issue links | `$.process.run` can run any program, and that's the scariest line in the call list | **Cut.** Links are later, if ever |
| Ledger in `$.store` and a gitignored file, cost per step | Cost per step is a number nobody acts on, and on a subscription it isn't a charge | **Cut.** This window's spend, rounded, and only on an API key |
| Plan from `TaskCreate`/`TaskUpdate` | The desktop app uses its own task tool, and some hosts still use `TodoWrite` | **Three sources, one shape** (§3) |

## 1. What a reviewer sees

`claude plugin validate .` lists every call the mod makes. This is the whole list:

```
calls: $.clock.now, $.command.run, $.prompt.fill, $.prompt.submit,
       $.session.usage, $.state.get, $.state.set, $.ui.resolve
```

- **No** `$.fs`, `$.process`, `$.http`, `$.model`, `$.tool.register` or `$.store`. Nothing leaves the machine and nothing is written to disk.
- `$.prompt.submit` runs only when you press **Handoff**. It sends one visible prompt asking for the brief.
- `$.command.run('clear')` runs only when you press **Start next window**, after the brief is on screen.
- The two observer hooks (`prompt.submit`, `tool.call`) have a `.catch` that hands the call through untouched. Burndown can't block a tool or a prompt, even if it fails.

## 2. The bar

One row, sized to `bodyColumns` (which already shrinks when a pane is docked).

| Part | Shows | Drops below |
|---|---|---|
| Context | `ctx 62%`, warning colour from 60%, error from 85% | never |
| Limit (subscription) | `5h 41% · 2h 10m` (the tightest window and the time to its reset) | the reset hides below 70 cells |
| Spend (API key) | `≈$3.10`, at most 6 cells. Hidden until there's a cost, so a Max user never sees dollars flip to limits | 45 cells |
| Sparkline | `▁▂▄█`, spend per turn, last 12 | 90 cells |
| Plan | `3/8 Wire payment step`, the title gets whatever room is left | the title hides under 8 cells of room |
| Right | `[Handoff]` once tight · `Writing brief…` · `[Start next window] [Not now]` | never |

The bar draws nothing until the first usage reading, and yields to surveys. The engine's own `[-]` collapses it.

## 3. The plan, from the task list Claude already keeps

| Source | Where | How it's read |
|---|---|---|
| `TaskCreate` / `TaskUpdate` | terminal, VS Code | the create result adds a step; the update input changes status or title, or deletes it |
| `TodoWrite` | older builds, some SDK hosts | the whole list each call |
| `*__update_plan` | the desktop app's task list | the whole list (`items`), or a move (`advance`, `done`, `start`) |

Burndown never asks Claude to keep a second list. Subagent calls are ignored. A `/clear` empties the plan, because the task list belongs to the old session.

## 4. Handoff

1. **Handoff** (shown once context ≥ 60% or a limit ≥ 85%) submits a fixed prompt (`src/handoff.ts`): reply with only a brief under 300 words in six fields, Goal, Done, Next, Open, Watch out and Files, run no tools, include no secrets.
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
src/handoff.ts                    the brief prompt and the next-window prompt
src/format.ts                     money, time to reset, sparkline, clip (pure)
types/index.d.ts                  the $.state contract
test/                             claude plugin test: pure tables + render on 4 surfaces
```

## 6. Checks

- `claude plugin validate .` passes and prints the call list above.
- `claude plugin test .` runs 12 tests: formatting tables, the three plan sources, and the bar mounted on terminal, desktop, VS Code and mobile, including the full handoff flow, a Handoff pressed mid-turn and a refused submit.
- `tsc -p .` is clean under `strict` and `noUncheckedIndexedAccess`.

## 7. Later

- v1.1: the plan widget (a glance only, no clicks) for desktop, opened after the first task.
- CI that fails if `claude plugin validate --json` lists a call outside the allowlist in §1.
- Maybe: a status-line command for terminal users who don't install mods.
- Not planned: `gh` links, cost per step, team rollups. Each one widens the access list.
