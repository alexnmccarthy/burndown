import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { BurndownHandoff } from '../types'

import { bar } from '../src/bar'
import { BRIEF_PROMPT, nextWindowPrompt } from '../src/handoff'
import { addTurn, EMPTY_METER, readMeter } from '../src/meter'
import {
  EMPTY,
  isDesktopPlanTool,
  onDesktopPlan,
  onTaskCreate,
  onTaskUpdate,
  onTodoWrite,
} from '../src/plan'

const meter = atom({ plugin: 'burndown', key: 'meter' } as const, EMPTY_METER, { shape: 'meter-1' })
const plan = atom({ plugin: 'burndown', key: 'plan' } as const, EMPTY, { shape: 'plan-1' })
const IDLE: BurndownHandoff = { stage: 'idle' }
const handoff = atom({ plugin: 'burndown', key: 'handoff' } as const, IDLE, {
  shape: 'handoff-1',
})

/** Reads usage once (free) and stores what the bar shows. */
async function refresh($: EngineInterface) {
  const u = await $.session.usage()
  await update($, meter, m => readMeter(u, m))
}

export const register: Register = on => {
  // The spend when the current main-loop turn began, for the per-turn sparkline.
  let usdAtStart: number | undefined
  // The turn answering BRIEF_PROMPT, so a turn already running when Handoff is pressed is not taken for it.
  let briefTurn: string | undefined

  on('session.start', async ($, e, next) => {
    const out = await next(e)
    await refresh($)
    return out
  })

  // At turn.start, not prompt.submit: a prompt queued mid-turn must not reset the running turn's baseline.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      usdAtStart = (await $.session.usage()).cost?.usd
      // Only the turn that carries our own brief request may become the brief.
      if (e.text.startsWith(BRIEF_PROMPT.slice(0, 40)) && (await read($, handoff)).stage === 'writing') {
        briefTurn = e.turnId
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // A /clear starts a new window: the old task list and turns no longer apply.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, plan, () => EMPTY)
      await update($, meter, () => EMPTY_METER)
      await update($, handoff, () => IDLE) // a brief from the old window must not offer itself in the new one
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    await refresh($)
    await update($, meter, m => addTurn(m, usdAtStart))
    const ho = await read($, handoff)
    if (ho.stage === 'writing' && e.turnId === briefTurn) {
      briefTurn = undefined
      const brief = e.reason === 'answer' ? e.answer.trim() : ''
      await update($, handoff, (): BurndownHandoff => (brief ? { stage: 'ready', brief } : IDLE))
    }
    return out
  })

  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    if (out.deny !== undefined || out.isError) return out
    const tool = String(e.tool)
    // Subagents write the session's task list too; only their TodoWrite and desktop lists are their own.
    if (e.agentId !== undefined && tool !== 'TaskCreate' && tool !== 'TaskUpdate') return out
    if (tool === 'TaskCreate') await update($, plan, p => onTaskCreate(p, out.result))
    else if (tool === 'TaskUpdate') await update($, plan, p => onTaskUpdate(p, e))
    else if (tool === 'TodoWrite') {
      const todos = onTodoWrite(e)
      if (todos) await update($, plan, () => todos)
    } else if (isDesktopPlanTool(tool)) await update($, plan, p => onDesktopPlan(p, e))
    return out
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const m = await read($, meter)
    if (m.contextPct === undefined && m.usd === undefined && !m.limit) return next(e)
    const ui = $.ui.resolve(e)
    return bar(ui, {
      meter: m,
      plan: await read($, plan),
      handoff: await read($, handoff),
      columns: e.props.bodyColumns,
      isWorking: e.props.isWorking,
      now: await $.clock.now(),
      onHandoff: async () => {
        await update($, handoff, (): BurndownHandoff => ({ stage: 'writing' }))
        // A refused or dropped submit never starts a turn, so nothing would end 'writing'.
        const sent = await $.prompt.submit({ text: BRIEF_PROMPT }).catch(() => undefined)
        if (!sent || 'drop' in sent) await update($, handoff, () => IDLE)
      },
      onNextWindow: async () => {
        const ho = await read($, handoff)
        if (ho.stage !== 'ready') return
        await $.command.run({ command: 'clear' })
        await update($, handoff, () => IDLE)
        await $.prompt.fill({ text: nextWindowPrompt(ho.brief) })
      },
      onCancel: () => update($, handoff, () => IDLE),
    })
  }).catch(($, e, next) => next(e)) // an older build refusing a prop draws nothing, never an error
}
