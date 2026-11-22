# Burndown: architecture plan (v2)

> A Claude Code mod with two parts: a **bar** above the prompt and a **plan widget** in the corner. The plan burns down and so does the budget, and both stay in view.
>
> Design source: the "Claude Code mod: plan, cost and handoff" canvas. Adversarial review: [`ADVERSARIAL-REVIEW.md`](./ADVERSARIAL-REVIEW.md).
>
> **Scope:** the bar and the widget. Not in scope: merge toasts, New-session start cards, queue mode, a sessions sidebar.

---

## 0. What changed after the adversarial review

| v1 said | Review found (verified against API build 2.1.330) | v2 does |
|---|---|---|
| "The plan lives only in Claude's head" and the mod adds its own `plan_update` tools | Claude Code already has a task list (`TaskCreate`/`TaskUpdate`/`TaskList`) that survives compaction, plus plan mode's plan file | **Reads the built-in task list.** The mod adds only what's missing: issue links, cost, windows |
| Dollars are the headline | On Max/Pro, the number people act on is the 5-hour or 7-day limit (`rateLimits`, free in the same call) | **Subscription: shows limits. API key: shows dollars** |
| The widget is a clickable card | The API says "clicks may not reach" a widget | **The widget is a glance with no clicks.** The full view opens from the bar chip or `/burndown` |
| Handoff = copy, `/clear`, prefill at `session.start` | No `session.start` fires after `/clear`. `$.ui.copy` has no path on remote surfaces (desktop). `$.command.run` takes `command`, not `name` | **One handler does it all:** summarize → write file → `/clear` → `$.prompt.fill`. The clipboard is a fallback |
| Per-step costs to the cent, committed to git | Spend gets published in a public or client repo. Attribution is imprecise (subagents, mod model calls, resets) | **Private by default.** Costs stay in a gitignored ledger, are rounded, and show an "other" bucket |
| `/plan` command | It may collide with built-in plan mode | **`/burndown`** |

The review's verdicts: buildable as a mod (*partly*), will look native, not like the canvas (*partly*), fits screens with explicit overflow rules (*partly*), useful mainly for context and handoff (*partly*), **no commercial product-market fit, a strong portfolio piece**. See §11 for what that means for the launch.

---

## 1. The product, in one paragraph

Long Claude Code work spans several context windows. Along the way you lose track of three things: **where you are in the plan, how much room or budget is left, and what the next window needs to know.** Burndown keeps all three visible:

1. **The bar** sits above the prompt. It shows how full the context is, the rate limit (on a subscription) or the cost (on an API key), a sparkline per turn, and a plan chip. A **Handoff** button appears once context passes the threshold.
2. **The widget** sits in the corner. It's a glance at the plan: title, progress, the step in flight, what's next, and how many windows so far.
3. **The full view** opens from the chip or `/burndown`. It has every step, the issue/PR link for each, fixes tucked under their parent step, the cost so far, and the **handoff** view.

**Pitch for product people:** *never lose the thread between windows, and see what a ticket really took.*

---

## 2. Feasibility map (mod API, build 2.1.330)

| Element | API | Status |
|---|---|---|
| Bar | `ui.render` on `AbovePrompt`. Props: `bodyColumns`, `isWorking`, `isCollapsed`, `hasSurvey` | ✅ documented pattern |
| Context %, rate limits, cost | `$.session.usage()` → `context.percent`, `rateLimits[]` (`five_hour`/`seven_day`, `resetsAt`), `cost.usd`, `cost.hasUnknownPrice`. Free to call | ✅ |
| Sparkline | Delta per turn. `Svg` on desktop and mobile, `▁▂▃▅▇` on the terminal | ✅ data · 🔬 `Svg` inside the band on desktop |
| Context meter | `Progress` | ✅ |
| Plan steps | Watch `tool.call` for `TaskCreate`/`TaskUpdate`. Seed from `$.tool.call({ tool: 'TaskList' })` and plan mode's plan file | 🔬 that `TaskList` is callable from a mod and returns ids and status |
| Links and sub-fixes | Task `metadata` (`{ issue, parent }`) where Claude sets it, else the mod's own map keyed by task id. One optional tool: `burndown_link(taskId, url)` | ✅ |
| Widget | `$.ui.open({ id: 'burndown', placement: 'widget' })`. Draw `glance()` when `placement === 'widget'`. Desktop only | ✅ · the surface decides where it goes |
| Full view | Same pane, `placement: 'dock'` or `'inline'` | ✅ |
| Styling | `Text` `size`/`weight`/`strikethrough`/`tabular`/`dimColor`. `Box` flex, padding, `backgroundColor`, terminal border styles. **No radius, shadow or font** | ✅ see §6 |
| Handoff summary | `$.model.fork({ effort: 'low', … })` reuses the cache, and its cost is tagged "handoff" in the ledger | ✅ · 🔬 cost per fork |
| Handoff → new window | One press handler: write `.claude/handoffs/<plan>-w<N>.md` → `$.command.run({ command: 'clear' })` → `$.prompt.fill({ text })` | 🔬 can a press run `/clear`, do registrations survive, does `fill` land |
| Fallback | `$.ui.copy` (terminal only), then a toast: "Handoff saved. Run /clear and paste." | ✅ |
| Issue/PR status | `$.process.run(['gh', …])`, cached in `$.store`. Optional | ✅ degrades to plain links |
| Command | `/burndown` (open the full view), `/burndown handoff`, `/burndown stop` | ✅ check for collisions with `$.command.list()` |
| Persistence | `$.store` (4 MiB, pruned). Ledger mirrored to gitignored `.claude/burndown/ledger.json` | ✅ |
| Redraws | `$.state` reads subscribe automatically. `$.ui.invalidate` is capped at 10/s (30/s on the terminal), so don't invalidate per token | ✅ |

🔬 = answered in Phase 0 before anything else is built.

---

## 3. System shape

```
 Engine events: session.start · session.end · prompt.submit · tool.call(Task*) · turn.complete
                ui.render(AbovePrompt) · ui.render(Pane:burndown) · command.run
        │                         │                              │
        ▼                         ▼                              ▼
 ┌──────────────┐        ┌────────────────┐            ┌──────────────────┐
 │ meter/       │        │ plan/          │            │ handoff/         │
 │ usage poll   │        │ mirror of the  │            │ fork → file →    │
 │ ledger       │──cost─▶│ built-in tasks │──steps────▶│ clear → fill     │
 │ (per window, │        │ + links map    │            │                  │
 │  per step)   │        │ + windows      │            └──────────────────┘
 └──────┬───────┘        └──────┬─────────┘
        │ atoms ($.state)       │ atoms
        ▼                       ▼
 ┌──────────────┐        ┌───────────────────────────────────────────┐
 │ ui/bar.tsx   │        │ ui/pane.tsx: widget→glance · dock→full ·  │
 │ tiers by     │        │ view=handoff                              │
 │ bodyColumns  │        └───────────────────────────────────────────┘
 └──────────────┘
```

**Rules**
- **The built-in task list is the truth for steps.** Burndown adds a thin layer (links, cost, windows) and never asks Claude to keep a second list.
- **The UI is pure.** `ui/*` reads atoms only. All I/O lives in `meter/`, `plan/`, `handoff/` and `github/`, so render tests seed state and check trees.
- **Honest numbers.** Money is labeled ≈, rounded to $0.10 in step rows. Unattributed spend shows as "other". `hasUnknownPrice` shows as "≈?".

---

## 4. Data model

```ts
type StepStatus = 'pending' | 'in_progress' | 'completed'   // mirrors the task list
type Step = {
  taskId: string; title: string; status: StepStatus
  parent?: string                  // a sub-fix, from metadata.parent or blockedBy
  link?: { label: string; url: string }
  usd: number                      // attributed, estimate
}
type Window = { sessionId: string; startedAt: number; endedAt?: number; usd: number; other: number; reason?: string }
type Meter = {
  contextPct: number | null
  limit?: { kind: 'five_hour' | 'seven_day'; pct: number; resetsAt: number }
  windowUsd: number; turns: number[]          // per-turn deltas, last 24
  unknownPrice: boolean
}

interface PluginState {
  burndown: {
    meter: Meter
    plan: { title: string; link?: Link; steps: Step[]; windows: Window[] } | null
    ui: { view: 'plan' | 'handoff'; openStep: string | null }
  }
}
```

**Ledger rules (from the review's attribution findings)**
1. Snapshot `cost.usd` at `prompt.submit` and `turn.complete`. Ignore `turn.complete` that carries an `agentId`; subagent spend lands in the next main-turn delta, labeled as such.
2. A turn goes to the step `in_progress` when it **started**. If no step was in progress, it goes to "other".
3. Snapshot on **every** `session.end` (`clear`, `resume`, exit). Key windows by `sessionId`, so `/resume` swaps don't double-count.
4. Burndown's own `$.model.fork` is recorded as "handoff" and never charged to a step.
5. Nothing is written to a git-tracked file. `.claude/burndown/` and `.claude/handoffs/` are added to `.gitignore` on first run, after asking.

---

## 5. The two UI pieces

### 5.1 Bar
One row. Contents are tiered by `bodyColumns`, which already reflects a docked pane narrowing the column.

| bodyColumns | Subscription | API key |
|---|---|---|
| ≥ 100 | `[▓▓▓▓░░] 62% ctx · 5h 41% resets 3:10 · ▂▃▅▆▇ ··· [Handoff] (● #120 3/8 ⌄)` | `… · ≈$3.10 this window · ≈$17 total · ▂▃▅▆▇ …` |
| 70–99 | drop the sparkline, `resets` → time only | drop the sparkline |
| 45–69 | `62% · 5h 41% · (● 3/8)`, Handoff moves into the chip | `62% · ≈$3.10 · (● 3/8)` |
| < 45 | `62% · (● 3/8)` | same |

States: no plan (chip says `Track`, which seeds from the task list), running (blue dot), past the threshold (Handoff button, accent colour), working (figures dim). The bar yields to `hasSurvey` and `isCollapsed`. Threshold: context ≥ 50%, **or** 5-hour limit ≥ 80%, set via `userConfig`.

### 5.2 Widget: a glance, no clicks
```
#120 Checkout v2                 3 / 8
▓▓▓▓▓▓░░░░░░░░░░░░░
● Wire payment step         window 4
  next: Error states
```
At most 4 lines and a fixed shape. Titles use `wrap: 'truncate-end'`. Nothing in it needs a click. The full view opens from the bar chip, `/burndown`, or the host's own expand control.

### 5.3 Full view (dock or inline)
- Steps: up to 8 visible, then "+N more". Done steps are struck through and dim, the in-flight step is semibold, sub-fixes are indented with ↳. A link chip sits on the right (`#142`, `PR #131`). Selecting a row shows its cost and detail.
- Footer: `≈$17.45 over 4 windows (other $0.60)` · **Handoff** · **Stop tracking** (with Undo). "Cancel" vs "Stop" are merged into one action.
- Handoff view: Done / Next / Your call, the prompt preview, and **Start next window** (primary) or **Save only**.

### 5.4 Overflow rules
- Money uses a fixed 6-cell slot (`≈$999`, then `≈$1.2k`).
- The chip is capped at 12 cells.
- Titles are one line in the widget and two lines (`maxLines: 2`) in the full view.
- If the task list goes past 20 items, completed steps collapse into "✓ 14 done".

### 5.5 Surfaces
| | Bar | Plan |
|---|---|---|
| Desktop | `Svg` sparkline, `Progress` | widget → dock |
| Terminal ≥ 110 columns, fullscreen | block-character sparkline | dock, when asked (unasked panes only seat from 144 columns) |
| Terminal < 110 columns | compact tier | inline pane, `rows: 10`, opened by `/burndown` |
| VS Code | as desktop | dock (no widget) |
| Mobile | compact tier | inline glance |

---

## 6. Will it look right?

The canvas is pixel-designed (22 px radii, shadows, Hanken Grotesk). Mods draw **semantic trees**, not pixels: there's no radius, shadow or font family, and the host draws the widget frame. So:

- **What carries over:** hierarchy (`Text size: heading/body/caption`, `weight`), strike-through, status dots, tabular money, spacing (`gap`, `padding`), a single accent colour.
- **What the host owns:** corners, shadow, typeface, dark mode. That's a feature, because Burndown looks native in every theme.
- **The canvas will be redrawn from real renders after Phase 0** (desktop, terminal at 80/120/160 columns, VS Code). The README shows only what actually installs.

---

## 7. Repository layout

```
burndown/
├─ .claude-plugin/marketplace.json     # /plugin install burndown --marketplace alexnmccarthy/burndown
├─ plugins/burndown/
│  ├─ .claude-plugin/plugin.json       # "types": "./types/index.d.ts", userConfig: thresholds
│  ├─ hooks/hooks.json                 # { "modules": ["./register.tsx"] }
│  ├─ hooks/register.tsx               # wiring only
│  ├─ src/meter/{usage,ledger}.ts
│  ├─ src/plan/{mirror,links}.ts
│  ├─ src/handoff/{summarize,write,next-window}.ts
│  ├─ src/github.ts
│  ├─ src/ui/{bar,glance,full,handoff,format}.tsx
│  ├─ types/index.d.ts
│  └─ test/*.test.tsx                  # claude plugin test
├─ docs/{ARCHITECTURE,ADVERSARIAL-REVIEW,PRIVACY}.md  docs/screens/
├─ .github/workflows/ci.yml            # plugin validate · tsc · plugin test · "no $.http" guard
└─ README.md
```

---

## 8. Phases (each one ships)

| # | Ship | Contents | Exit criteria |
|---|---|---|---|
| 0 | **Spike** (1–2 days) | throwaway mod | Every 🔬 in §2 answered on desktop and terminal, with screenshots |
| 1 | **The bar** | meter, ledger, bar, thresholds | Matches `/cost` and `/context`. Readable at 4 widths. **Released on its own, and used to check whether people install it** |
| 2 | **Plan glance** | task-list mirror, widget, full view, `/burndown` | Works with zero setup on any session that uses the task list |
| 3 | **Handoff** | fork summary, file, one-press next window | A fresh window resumes with no re-explaining, in 3 of 3 test runs |
| 4 | **Links** | `burndown_link`, `gh` status | Degrades to plain links without `gh` |
| 5 | **Launch** | README, GIF, PRIVACY.md, marketplace | Installs in one command |

---

## 9. Privacy and trust (public repo)
- No network except `gh` (read-only; every command it runs is listed in PRIVACY.md). CI fails if `$.http` is used.
- Ledger and handoffs are gitignored by default. Handoffs go through the secret scanner before they're written.
- `$.state` is readable by other installed mods. Plan titles and costs live there, and that's documented.
- The canvas footer handle is scrubbed.

---

## 10. Later
Queue mode, a budget per plan, team rollups (which conflict with the local-only promise, so they need their own design), Linear and Jira links, a status-line fallback for people who won't install mods.

---

## 11. Positioning (read the review's §5)
The space is crowded with free tools: ccusage and several status lines cover cost, and 8+ plugins cover handoff. There's no buyer. **Burndown is a portfolio piece that shows how a product person scopes, challenges and ships an AI-native tool.** Two things set it apart:
- It's the first **GUI-native** mod tying plan, limits and handoff together.
- It ships with this public architecture doc **and** the adversarial review that changed it.

The repo itself is the demo.
